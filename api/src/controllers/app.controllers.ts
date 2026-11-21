import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, NotFoundException, Param, ParseUUIDPipe,
  Patch, Post, Put, Query, UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Auth, AuthUser, clean, CurrentUser } from '../common';
import { Booking, Category, Driver, Enquiry, Extra, Place, User, Vehicle } from '../entities';
import { BookingService } from '../services/booking.service';
import { MailService, SettingsService } from '../services/core.services';
import { PaymentService } from '../services/payment.service';
import { SeedService } from '../services/seed.service';
import { PRESETS } from '../services/defaults';
import { config } from '../config';

/* ================= auth ================= */
@Controller('api/auth')
export class AuthController {
  constructor(@InjectRepository(User) private users: Repository<User>, private jwt: JwtService) {}

  @Post('login') @HttpCode(200) @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() body: any) {
    const { email, password } = clean<any>(body, { email: { type: 'email', required: true }, password: { type: 'string', required: true, max: 200 } });
    const u = await this.users.findOne({ where: { email } });
    const ok = u && u.active && (await bcrypt.compare(password, u.passwordHash));
    if (!ok) throw new UnauthorizedException('Email or password is incorrect');
    u.lastLoginAt = new Date(); await this.users.save(u);
    const token = await this.jwt.signAsync({ sub: u.id, email: u.email, name: u.name, role: u.role, driverId: u.driverId });
    return { token, user: { id: u.id, name: u.name, email: u.email, role: u.role, driverId: u.driverId } };
  }

  @Get('me') @Auth()
  me(@CurrentUser() u: AuthUser) { return u; }

  @Post('password') @HttpCode(200) @Auth() @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async password(@CurrentUser() me: AuthUser, @Body() body: any) {
    const { current, next } = clean<any>(body, { current: { type: 'string', required: true, max: 200 }, next: { type: 'string', required: true, max: 200 } });
    if (next.length < 8) throw new BadRequestException('Use at least 8 characters');
    const u = await this.users.findOne({ where: { id: me.id } });
    if (!u || !(await bcrypt.compare(current, u.passwordHash))) throw new BadRequestException('Current password is incorrect');
    u.passwordHash = await bcrypt.hash(next, 10); await this.users.save(u);
    return { ok: true };
  }
}

/* ================= public website ================= */
@Controller('api/public')
export class PublicController {
  constructor(
    private settings: SettingsService, private bookings: BookingService, private payments: PaymentService, private mail: MailService,
    @InjectRepository(Category) private categories: Repository<Category>, @InjectRepository(Place) private places: Repository<Place>,
    @InjectRepository(Extra) private extras: Repository<Extra>, @InjectRepository(Enquiry) private enquiries: Repository<Enquiry>,
  ) {}

  @Get('health') health() { return { ok: true }; }

  @Get('site')
  async site() {
    const [brand, content, pricing, categories, places, extras] = await Promise.all([
      this.settings.brand(), this.settings.content(), this.settings.pricing(),
      this.categories.find({ where: { active: true }, order: { sort: 'ASC', name: 'ASC' } }),
      this.places.find({ order: { sort: 'ASC', name: 'ASC' } }), this.extras.find({ where: { active: true }, order: { name: 'ASC' } }),
    ]);
    const { notifyEmail, ...publicBrand } = brand;
    return {
      brand: publicBrand, content, categories, places: places.map(({ id, name, type }) => ({ id, name, type })), extras,
      pricing: { taxLabel: pricing.taxLabel, tax: pricing.tax, minHours: pricing.minHours, kmPerHour: pricing.kmPerHour, cancelHours: pricing.cancelHours, minNoticeMinutes: pricing.minNoticeMinutes },
      payments: { card: this.payments.enabled && pricing.payCard !== false, provider: this.payments.provider, cash: pricing.payCash !== false, account: !!pricing.payAccount },
    };
  }

  @Post('quote') @HttpCode(200) @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async quote(@Body() body: any) { return this.bookings.quoteTrip(await this.bookings.parseTrip(body)); }

  @Post('bookings') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Body() body: any) { return this.bookings.create(body, 'website'); }

  @Post('bookings/find') @HttpCode(200) @Throttle({ default: { limit: 20, ttl: 60_000 } })
  find(@Body() body: any) { return this.bookings.publicDetails(body?.ref, body?.email); }

  @Post('bookings/cancel') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(@Body() body: any) { return this.bookings.cancelPublic(body?.ref, body?.email); }

  @Post('payments/razorpay') @HttpCode(200) @Throttle({ default: { limit: 20, ttl: 60_000 } })
  razorpay(@Body() b: any) { return this.bookings.confirmRazorpay(String(b?.ref || ''), String(b?.orderId || ''), String(b?.paymentId || ''), String(b?.signature || '')); }

  @Post('payments/stripe') @HttpCode(200) @Throttle({ default: { limit: 20, ttl: 60_000 } })
  stripe(@Body() b: any) { return this.bookings.confirmStripe(String(b?.ref || ''), String(b?.sessionId || '')); }

  @Post('enquiries') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async enquiry(@Body() body: any) {
    if (body?.website) return { ok: true }; // honeypot
    const e = clean<any>(body, { name: { type: 'string', required: true, max: 120 }, email: { type: 'email', required: true }, phone: { type: 'string', max: 40 }, message: { type: 'text', required: true, max: 3000 } });
    await this.enquiries.save(this.enquiries.create(e));
    const brand = await this.settings.brand();
    if (brand.notifyEmail) this.mail.send(brand.notifyEmail, `New enquiry from ${e.name}`, `<p><b>${e.name.replace(/</g, '&lt;')}</b> (${e.email}${e.phone ? ', ' + e.phone.replace(/</g, '&lt;') : ''}) wrote:</p><p style="white-space:pre-wrap">${e.message.replace(/</g, '&lt;')}</p>`, e.email);
    return { ok: true };
  }
}

/* ================= staff: bookings, dashboard, enquiries ================= */
@Controller('api/admin')
export class AdminController {
  constructor(
    private bookings: BookingService, private settings: SettingsService, private seed: SeedService, private mail: MailService, private payments: PaymentService,
    @InjectRepository(Enquiry) private enquiries: Repository<Enquiry>,
  ) {}

  @Get('dashboard') @Auth('admin', 'dispatcher') dashboard() { return this.bookings.stats(); }

  @Get('bookings') @Auth('admin', 'dispatcher') list(@Query() q: any) { return this.bookings.list(q); }

  @Get('bookings.csv') @Auth('admin', 'dispatcher') @Header('Content-Type', 'text/csv; charset=utf-8')
  csv(@Query() q: any) { return this.bookings.csv(q); }

  @Get('bookings/:ref') @Auth('admin', 'dispatcher') get(@Param('ref') ref: string) { return this.bookings.get(ref); }

  @Patch('bookings/:ref') @Auth('admin', 'dispatcher')
  update(@Param('ref') ref: string, @Body() body: any, @CurrentUser() u: AuthUser) { return this.bookings.update(ref, body, u.name); }

  @Post('bookings') @Auth('admin', 'dispatcher')
  async create(@Body() body: any, @CurrentUser() u: AuthUser) {
    const r = await this.bookings.create(body, 'staff', u.name);
    return r.booking;
  }

  @Post('quote') @HttpCode(200) @Auth('admin', 'dispatcher')
  async quote(@Body() body: any) { return this.bookings.quoteTrip(await this.bookings.parseTrip(body, true)); }

  @Post('bookings/:ref/refund') @HttpCode(200) @Auth('admin')
  refund(@Param('ref') ref: string, @CurrentUser() u: AuthUser) { return this.bookings.refund(ref, u.name); }

  @Get('enquiries') @Auth('admin', 'dispatcher') listEnquiries() { return this.enquiries.find({ order: { createdAt: 'DESC' }, take: 500 }); }

  @Patch('enquiries/:id') @Auth('admin', 'dispatcher')
  async enquiryStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    const { status } = clean<any>(body, { status: { type: 'enum', values: ['New', 'Handled'], required: true } });
    await this.enquiries.update(id, { status });
    return { ok: true };
  }

  @Delete('enquiries/:id') @Auth('admin')
  async enquiryDelete(@Param('id', ParseUUIDPipe) id: string) { await this.enquiries.delete(id); return { ok: true }; }

  /* settings */
  @Get('settings') @Auth('admin')
  async allSettings() {
    return { brand: await this.settings.brand(), content: await this.settings.content(), pricing: await this.settings.pricing(), presets: Object.entries(PRESETS).map(([k, p]) => ({ key: k, label: p.label })), status: { payments: this.payments.provider, email: this.mail.enabled, maps: !!config.googleMapsKey, appUrl: config.appUrl } };
  }

  @Put('settings/brand') @Auth('admin')
  async brand(@Body() body: any) {
    const v = clean<any>(body, {
      name: { type: 'string', required: true, max: 80 }, tagline: { type: 'string', max: 160 }, primary: { type: 'color', required: true }, city: { type: 'string', max: 80 },
      phone: { type: 'string', max: 40 }, whatsapp: { type: 'string', max: 40 }, email: { type: 'string', max: 190 }, address: { type: 'string', max: 200 },
      currency: { type: 'string', required: true, max: 3 }, locale: { type: 'string', required: true, max: 12 }, timezone: { type: 'string', required: true, max: 60 },
      notifyEmail: { type: 'string', max: 190 }, logoText: { type: 'string', max: 4 },
    });
    v.currency = v.currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(v.currency)) throw new BadRequestException('Currency must be a 3-letter code like USD');
    try { new Intl.NumberFormat(v.locale, { style: 'currency', currency: v.currency }); new Intl.DateTimeFormat('en', { timeZone: v.timezone }); } catch { throw new BadRequestException('Unknown locale, currency or time zone'); }
    return this.settings.set('brand', { ...(await this.settings.brand()), ...v });
  }

  @Put('settings/pricing') @Auth('admin')
  async pricing(@Body() body: any) {
    const pct = { type: 'number', min: 0, max: 100 } as const, hr = { type: 'int', min: 0, max: 23 } as const;
    const v = clean<any>(body, {
      taxLabel: { type: 'string', required: true, max: 20 }, tax: pct, airportFee: { type: 'number', min: 0, max: 1e6 }, nightPct: pct, nightStart: hr, nightEnd: hr,
      roundDisc: pct, minHours: { type: 'int', min: 1, max: 24 }, kmPerHour: { type: 'int', min: 0, max: 500 }, cancelHours: { type: 'number', min: 0, max: 720 },
      minNoticeMinutes: { type: 'int', min: 0, max: 10080 }, payCash: { type: 'bool' }, payAccount: { type: 'bool' }, payCard: { type: 'bool' },
    }, true);
    return this.settings.set('pricing', { ...(await this.settings.pricing()), ...v });
  }

  @Put('settings/content') @Auth('admin')
  async content(@Body() body: any) {
    const v = clean<any>(body, { heroTitle: { type: 'string', required: true, max: 120 }, heroSub: { type: 'text', max: 400 }, about: { type: 'text', max: 1000 }, metaDescription: { type: 'string', max: 300 }, terms: { type: 'text', max: 5000 } }, true);
    const list = (arr: any, schema: any, max = 30) => (Array.isArray(arr) ? arr.slice(0, max).map((x) => clean(x, schema)) : undefined);
    const icon = { type: 'enum', values: ['plane', 'city', 'clock', 'road', 'brief', 'group', 'shield', 'tag', 'headset', 'car', 'pin', 'check'] };
    const features = list(body?.features, { icon, t: { type: 'string', required: true, max: 60 }, d: { type: 'string', max: 200 } }, 8);
    const services = list(body?.services, { icon, t: { type: 'string', required: true, max: 60 }, d: { type: 'text', max: 400 } }, 12);
    const faq = list(body?.faq, { q: { type: 'string', required: true, max: 200 }, a: { type: 'text', required: true, max: 1500 } }, 30);
    const cur = await this.settings.content();
    return this.settings.set('content', { ...cur, ...v, ...(features ? { features } : {}), ...(services ? { services } : {}), ...(faq ? { faq } : {}) });
  }

  @Post('settings/preset') @HttpCode(200) @Auth('admin')
  async preset(@Body() body: any) {
    if (!PRESETS[body?.key]) throw new BadRequestException('Unknown preset');
    await this.seed.applyPreset(body.key);
    (this.settings as any).cache.clear();
    return this.allSettings();
  }

  @Post('settings/test-email') @HttpCode(200) @Auth('admin')
  async testEmail(@CurrentUser() u: AuthUser) {
    if (!this.mail.enabled) throw new BadRequestException('Email is not set up on the server (SMTP_HOST is empty)');
    this.mail.send(u.email, 'Test email', '<p>Email sending works.</p>');
    return { ok: true };
  }
}

/* ================= staff accounts ================= */
@Controller('api/admin/users')
export class UsersController {
  constructor(@InjectRepository(User) private users: Repository<User>) {}
  private view = (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role, driverId: u.driverId, active: u.active, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt });
  private schema = { name: { type: 'string', required: true, max: 120 }, email: { type: 'email', required: true }, role: { type: 'enum', values: ['admin', 'dispatcher', 'driver'], required: true }, driverId: { type: 'uuid', nullable: true }, active: { type: 'bool' }, password: { type: 'string', max: 200 } } as const;

  @Get() @Auth('admin') async list() { return (await this.users.find({ order: { name: 'ASC' } })).map(this.view); }

  @Post() @Auth('admin')
  async create(@Body() body: any) {
    const v = clean<any>(body, this.schema as any);
    if (!v.password || v.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (v.role === 'driver' && !v.driverId) throw new BadRequestException('Choose which driver this login belongs to');
    if (await this.users.exist({ where: { email: v.email } })) throw new ConflictException('A user with that email already exists');
    const u = await this.users.save(this.users.create({ name: v.name, email: v.email, role: v.role, driverId: v.role === 'driver' ? v.driverId : null, active: v.active !== false, passwordHash: await bcrypt.hash(v.password, 10) }));
    return this.view(u);
  }

  @Patch(':id') @Auth('admin')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @CurrentUser() me: AuthUser) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException();
    const v = clean<any>(body, this.schema as any, true);
    if (id === me.id && (v.role && v.role !== 'admin' || v.active === false)) throw new ForbiddenException('You cannot remove your own admin access');
    if (v.email && v.email !== u.email && (await this.users.exist({ where: { email: v.email } }))) throw new ConflictException('A user with that email already exists');
    if (v.password) { if (v.password.length < 8) throw new BadRequestException('Password must be at least 8 characters'); u.passwordHash = await bcrypt.hash(v.password, 10); }
    for (const k of ['name', 'email', 'role', 'active'] as const) if (v[k] !== undefined) (u as any)[k] = v[k];
    if (v.driverId !== undefined || v.role) u.driverId = u.role === 'driver' ? (v.driverId ?? u.driverId) : null;
    if (u.role === 'driver' && !u.driverId) throw new BadRequestException('Choose which driver this login belongs to');
    return this.view(await this.users.save(u));
  }

  @Delete(':id') @Auth('admin')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    if (id === me.id) throw new ForbiddenException('You cannot delete your own account');
    await this.users.delete(id);
    return { ok: true };
  }
}

/* ================= driver app ================= */
@Controller('api/driver')
export class DriverController {
  constructor(private bookings: BookingService, @InjectRepository(Booking) private repo: Repository<Booking>, @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>) {}

  @Get('trips') @Auth('driver')
  async trips(@CurrentUser() u: AuthUser) {
    if (!u.driverId) return [];
    const list = await this.repo.createQueryBuilder('b').where('b.driver_id = :d', { d: u.driverId })
      .andWhere(`(b.status in ('Assigned','On trip') or (b.status = 'Completed' and b.date >= current_date - 2))`).orderBy('b.date').addOrderBy('b.time').getMany();
    const vs = await this.vehicles.find();
    return list.map((b) => ({ ref: b.ref, type: b.type, pickup: b.pickup, dropoff: b.dropoff, date: b.date, time: b.time, hours: b.hours, km: b.km, pax: b.pax, bags: b.bags, categoryName: b.categoryName, name: b.name, phone: b.phone, flight: b.flight, notes: b.notes, status: b.status, payMethod: b.payMethod, payStatus: b.payStatus, total: b.total, currency: b.currency, vehicle: vs.find((v) => v.id === b.vehicleId)?.plate || '' }));
  }

  @Patch('trips/:ref') @Auth('driver')
  async update(@Param('ref') ref: string, @Body() body: any, @CurrentUser() u: AuthUser) {
    const b = await this.repo.findOne({ where: { ref } });
    if (!b || !u.driverId || b.driverId !== u.driverId) throw new NotFoundException('Trip not found');
    const { status } = clean<any>(body, { status: { type: 'enum', values: ['On trip', 'Completed'], required: true } });
    if (status === 'On trip' && b.status !== 'Assigned') throw new BadRequestException('This trip cannot be started');
    if (status === 'Completed' && b.status !== 'On trip') throw new BadRequestException('Start the trip first');
    await this.bookings.applyChanges(b, { status }, `${u.name} (driver)`);
    return { ok: true };
  }
}
