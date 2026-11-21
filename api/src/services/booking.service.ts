import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Booking, BookingEvent, BOOKING_STATUSES, Category, Driver, Extra, Promo, Vehicle } from '../entities';
import { clean, nowTimeIn, todayIn, addDaysStr } from '../common';
import { quote, PromoDef } from '../pricing/quote';
import { DistanceService, MailService, SettingsService } from './core.services';
import { PaymentService } from './payment.service';
import { config } from '../config';

const TRIP_SCHEMA = {
  type: { type: 'enum', values: ['oneway', 'round', 'hourly', 'airport'], required: true },
  pickup: { type: 'string', required: true, max: 300 },
  dropoff: { type: 'string', max: 300 },
  date: { type: 'date', required: true },
  time: { type: 'time', required: true },
  returnDate: { type: 'date' },
  returnTime: { type: 'time' },
  hours: { type: 'int', min: 0, max: 24 },
  pax: { type: 'int', min: 1, max: 60, required: true },
  bags: { type: 'int', min: 0, max: 60 },
  kmHint: { type: 'number', min: 1, max: 2000 },
  extras: { type: 'string' }, // replaced below (object)
  promo: { type: 'string', max: 40 },
} as const;

const CUSTOMER_SCHEMA = {
  categoryId: { type: 'uuid', required: true },
  name: { type: 'string', required: true, max: 120 },
  email: { type: 'email', required: true },
  phone: { type: 'string', required: true, max: 40 },
  flight: { type: 'string', max: 20 },
  notes: { type: 'text', max: 1000 },
  payMethod: { type: 'enum', values: ['card', 'cash', 'account'], required: true },
} as const;

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const minutesOf = (d: string, t: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), +t.slice(0, 2), +t.slice(3, 5)) / 60000;

export interface Trip {
  type: 'oneway' | 'round' | 'hourly' | 'airport'; pickup: string; dropoff: string; date: string; time: string;
  returnDate?: string; returnTime?: string; hours: number; pax: number; bags: number; kmHint?: number; extras: Record<string, number>; promo?: string;
}

@Injectable()
export class BookingService {
  private log = new Logger('Bookings');
  constructor(
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    @InjectRepository(BookingEvent) private events: Repository<BookingEvent>,
    @InjectRepository(Category) private categories: Repository<Category>,
    @InjectRepository(Extra) private extras: Repository<Extra>,
    @InjectRepository(Promo) private promos: Repository<Promo>,
    @InjectRepository(Driver) private drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    private ds: DataSource,
    private settings: SettingsService,
    private distance: DistanceService,
    private mail: MailService,
    private payments: PaymentService,
  ) {}

  /* ---------- quoting ---------- */
  async parseTrip(body: any, staff = false): Promise<Trip> {
    const t: any = clean({ ...body, extras: undefined }, TRIP_SCHEMA as any);
    t.dropoff = t.dropoff || '';
    t.hours = t.hours || 0; t.bags = t.bags || 0;
    const ex: Record<string, number> = {};
    if (body?.extras && typeof body.extras === 'object') for (const [k, v] of Object.entries(body.extras)) if (/^[0-9a-f-]{36}$/i.test(k)) ex[k] = Math.max(0, Math.min(10, Math.floor(Number(v) || 0)));
    t.extras = ex;
    if (t.type === 'hourly') t.dropoff = '';
    else if (!t.dropoff) throw new BadRequestException('Please enter a drop-off location');
    if (t.type !== 'hourly' && t.pickup.toLowerCase() === t.dropoff.toLowerCase()) throw new BadRequestException('Pickup and drop-off are the same');
    const brand = await this.settings.brand(), rules = await this.settings.pricing();
    const tz = brand.timezone || 'UTC';
    if (!staff) {
      const nowMin = minutesOf(todayIn(tz), nowTimeIn(tz));
      if (minutesOf(t.date, t.time) < nowMin + (rules.minNoticeMinutes || 0)) throw new BadRequestException(`Please book at least ${rules.minNoticeMinutes || 0} minutes ahead`);
      if (t.date > addDaysStr(todayIn(tz), 365)) throw new BadRequestException('Bookings can be made up to a year ahead');
    }
    if (t.type === 'round') {
      if (!t.returnDate || !t.returnTime) throw new BadRequestException('Please choose the return date and time');
      if (minutesOf(t.returnDate, t.returnTime) <= minutesOf(t.date, t.time)) throw new BadRequestException('The return must be after the outward trip');
    } else { t.returnDate = null; t.returnTime = null; }
    if (t.type === 'hourly') t.hours = Math.max(rules.minHours || 1, t.hours || rules.minHours || 2);
    if (t.type === 'airport' && !(await this.distance.isAirport(t.pickup)) && !(await this.distance.isAirport(t.dropoff))) throw new BadRequestException('For an airport transfer, choose an airport as pickup or drop-off');
    return t as Trip;
  }

  private async promoDefs(): Promise<PromoDef[]> {
    const list = await this.promos.find();
    if (!list.length) return [];
    const used = await this.bookings.createQueryBuilder('b').select('b.promo', 'code').addSelect('count(*)', 'n')
      .where('b.promo <> :e', { e: '' }).andWhere('b.status <> :c', { c: 'Cancelled' }).groupBy('b.promo').getRawMany();
    const u = Object.fromEntries(used.map((r) => [String(r.code).toUpperCase(), Number(r.n)]));
    return list.map((p) => ({ code: p.code, kind: p.kind, value: p.value, active: p.active, maxUses: p.maxUses, validUntil: p.validUntil, used: u[p.code.toUpperCase()] || 0 }));
  }

  async quoteTrip(t: Trip) {
    const [rules, cats, extras, promos] = await Promise.all([this.settings.pricing(), this.categories.find({ where: { active: true }, order: { sort: 'ASC', name: 'ASC' } }), this.extras.find({ where: { active: true } }), this.promoDefs()]);
    const dist = t.type === 'hourly' ? { km: 0, source: 'places' as const } : await this.distance.between(t.pickup, t.dropoff, t.kmHint);
    const airport = t.type === 'airport' || (await this.distance.isAirport(t.pickup)) || (await this.distance.isAirport(t.dropoff));
    const input = { type: t.type, km: dist.km, hours: t.hours, time: t.time, date: t.date, airport, extras: t.extras, promo: t.promo };
    const options = cats.filter((c) => c.seats >= t.pax && c.bags >= (t.bags || 0)).map((c) => ({
      category: { id: c.id, name: c.name, type: c.type, seats: c.seats, bags: c.bags, description: c.description },
      ...quote(rules, c, input, extras, promos),
    }));
    return { km: dist.km, kmSource: dist.source, minutes: (dist as any).minutes ?? null, airport, options };
  }

  /* ---------- creating ---------- */
  async create(body: any, source: 'website' | 'staff', actor = 'customer') {
    const t = await this.parseTrip(body, source === 'staff');
    const c: any = clean(body, CUSTOMER_SCHEMA as any);
    if (!/^\+?[\d\s()./-]{7,}$/.test(c.phone)) throw new BadRequestException('Please enter a valid phone number with country code');
    const rules = await this.settings.pricing();
    const brand = await this.settings.brand();
    if (c.payMethod === 'card' && (!this.payments.enabled || rules.payCard === false) && source !== 'staff') throw new BadRequestException('Online card payment is not available');
    if (c.payMethod === 'cash' && rules.payCash === false && source !== 'staff') throw new BadRequestException('Pay-the-driver is not available');
    if (c.payMethod === 'account' && !rules.payAccount && source !== 'staff') throw new BadRequestException('Corporate accounts are not available online');
    const q = await this.quoteTrip(t);
    const opt = q.options.find((o) => o.category.id === c.categoryId);
    if (!opt) throw new BadRequestException('That vehicle is not available for this many guests or bags');
    if (t.promo && opt.promoOk === false) throw new BadRequestException('That promo code is not valid');

    const b = this.bookings.create({
      ref: await this.newRef(brand.name), type: t.type, pickup: t.pickup, dropoff: t.dropoff, date: t.date, time: t.time,
      returnDate: t.returnDate || null, returnTime: t.returnTime || null, hours: t.type === 'hourly' ? t.hours : 0,
      km: q.km, kmSource: q.kmSource, pax: t.pax, bags: t.bags, categoryId: opt.category.id, categoryName: opt.category.name,
      extras: t.extras, promo: opt.promoOk || '', lines: opt.lines, total: opt.total, currency: brand.currency || 'USD',
      name: c.name, email: c.email, phone: c.phone, flight: c.flight || '', notes: c.notes || '', payMethod: c.payMethod,
      payStatus: c.payMethod === 'card' ? 'pending' : 'unpaid', payProvider: c.payMethod === 'card' ? this.payments.provider : '',
      status: 'Pending', source,
    });
    await this.bookings.save(b);
    await this.addEvent(b, source === 'staff' ? `Booked by staff (${c.payMethod})` : `Booked online (${c.payMethod === 'card' ? 'card payment started' : c.payMethod})`, actor);

    let payment = null;
    if (c.payMethod === 'card' && source !== 'staff') {
      try {
        payment = await this.payments.start(b, brand.name);
        await this.bookings.update(b.id, { payOrder: b.payOrder });
      } catch (e) {
        await this.bookings.update(b.id, { payStatus: 'failed' });
        throw e;
      }
    } else {
      this.notifyCreated(b);
    }
    return { booking: this.publicView(b), payment };
  }

  private async newRef(brandName: string) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const prefix = (String(brandName || 'RD').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'RD').padEnd(2, 'X');
    for (let i = 0; i < 10; i++) {
      let r = prefix + '-';
      for (let k = 0; k < 6; k++) r += A[randomInt(A.length)];
      if (!(await this.bookings.exist({ where: { ref: r } }))) return r;
    }
    throw new Error('Could not create a booking reference');
  }

  /* ---------- payments ---------- */
  async confirmRazorpay(ref: string, orderId: string, paymentId: string, signature: string) {
    const b = await this.bookings.findOne({ where: { ref } });
    if (!b || b.payOrder !== orderId) throw new NotFoundException('Booking not found');
    if (b.payStatus === 'paid') return this.publicView(b);
    if (!this.payments.verifyRazorpay(orderId, paymentId, signature)) throw new BadRequestException('Payment could not be verified');
    return this.markPaid(b, paymentId);
  }

  async confirmStripe(ref: string, sessionId: string) {
    const b = await this.bookings.findOne({ where: { ref } });
    if (!b || b.payOrder !== sessionId) throw new NotFoundException('Booking not found');
    if (b.payStatus === 'paid') return this.publicView(b);
    const s = await this.payments.stripeSession(sessionId);
    if (s.payment_status !== 'paid') throw new BadRequestException('Payment has not been completed');
    return this.markPaid(b, s.payment_intent);
  }

  private async markPaid(b: Booking, payRef: string) {
    b.payStatus = 'paid'; b.payRef = String(payRef || ''); if (b.status === 'Pending') b.status = 'Confirmed';
    await this.bookings.save(b);
    await this.addEvent(b, 'Paid online by card', 'customer');
    this.notifyCreated(b);
    return this.publicView(b);
  }

  /* ---------- customer self-service ---------- */
  async findPublic(ref: string, email: string) {
    const b = await this.bookings.findOne({ where: { ref: String(ref || '').trim().toUpperCase() } });
    if (!b || b.email.toLowerCase() !== String(email || '').trim().toLowerCase()) throw new NotFoundException('We could not find a booking with that reference and email');
    return b;
  }

  async publicDetails(ref: string, email: string) {
    const b = await this.findPublic(ref, email);
    const v: any = this.publicView(b);
    if (b.driverId && ['Assigned', 'On trip'].includes(b.status)) {
      const d = await this.drivers.findOne({ where: { id: b.driverId } });
      const veh = b.vehicleId ? await this.vehicles.findOne({ where: { id: b.vehicleId } }) : null;
      v.driver = d ? { name: d.name, phone: d.phone } : null;
      v.vehicle = veh ? { model: veh.model, plate: veh.plate, color: veh.color } : null;
    }
    v.canCancel = await this.canCustomerCancel(b);
    return v;
  }

  private async canCustomerCancel(b: Booking) {
    if (!['Pending', 'Confirmed', 'Assigned'].includes(b.status)) return false;
    const brand = await this.settings.brand(), rules = await this.settings.pricing(), tz = brand.timezone || 'UTC';
    return minutesOf(b.date, b.time) - minutesOf(todayIn(tz), nowTimeIn(tz)) >= (rules.cancelHours || 0) * 60;
  }

  async cancelPublic(ref: string, email: string) {
    const b = await this.findPublic(ref, email);
    if (!(await this.canCustomerCancel(b))) throw new ForbiddenException('This booking can no longer be cancelled online. Please contact us.');
    await this.applyChanges(b, { status: 'Cancelled' }, 'customer');
    return this.publicDetails(ref, email);
  }

  publicView(b: Booking) {
    const { id, ref, type, pickup, dropoff, date, time, returnDate, returnTime, hours, km, kmSource, pax, bags, categoryName, lines, total, currency, name, email, phone, flight, payMethod, payStatus, status } = b;
    return { id, ref, type, pickup, dropoff, date, time, returnDate, returnTime, hours, km, kmSource, pax, bags, categoryName, lines, total, currency, name, email, phone, flight, payMethod, payStatus, status };
  }

  /* ---------- staff ---------- */
  async list(q: any) {
    const brand = await this.settings.brand(); const today = todayIn(brand.timezone || 'UTC');
    const qb = this.bookings.createQueryBuilder('b');
    if (q.status && (BOOKING_STATUSES as readonly string[]).includes(q.status)) qb.andWhere('b.status = :s', { s: q.status });
    if (q.when === 'today') qb.andWhere('b.date = :t', { t: today });
    else if (q.when === 'upcoming') qb.andWhere('b.date >= :t', { t: today });
    else if (q.when === 'past') qb.andWhere('b.date < :t', { t: today });
    if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) qb.andWhere('b.date >= :f', { f: q.from });
    if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) qb.andWhere('b.date <= :to', { to: q.to });
    if (q.driverId) qb.andWhere('b.driver_id = :d', { d: q.driverId });
    if (q.q) {
      const s = `%${String(q.q).trim().toLowerCase().slice(0, 80)}%`;
      qb.andWhere(new Brackets((w) => w.where('lower(b.ref) like :s', { s }).orWhere('lower(b.name) like :s').orWhere('lower(b.email) like :s').orWhere('b.phone like :s').orWhere('lower(b.pickup) like :s').orWhere('lower(b.dropoff) like :s')));
    }
    const dir = q.when === 'past' ? 'DESC' : 'ASC';
    qb.orderBy('b.date', dir).addOrderBy('b.time', dir);
    const take = Math.min(500, Math.max(1, Number(q.limit) || 100)), skip = Math.max(0, Number(q.offset) || 0);
    const [items, total] = await qb.take(take).skip(skip).getManyAndCount();
    return { items, total };
  }

  async get(ref: string) {
    const b = await this.bookings.findOne({ where: { ref } });
    if (!b) throw new NotFoundException('Booking not found');
    const events = await this.events.find({ where: { bookingId: b.id }, order: { at: 'ASC' } });
    return { ...b, events };
  }

  async update(ref: string, body: any, actor: string) {
    const b = await this.bookings.findOne({ where: { ref } });
    if (!b) throw new NotFoundException('Booking not found');
    const ch: any = clean(body, { status: { type: 'enum', values: BOOKING_STATUSES }, driverId: { type: 'uuid', nullable: true }, vehicleId: { type: 'uuid', nullable: true }, note: { type: 'string', max: 300 }, payStatus: { type: 'enum', values: ['unpaid', 'paid', 'refund_due', 'refunded'] } } as any, true);
    await this.applyChanges(b, ch, actor);
    return this.get(ref);
  }

  async applyChanges(b: Booking, ch: { status?: string; driverId?: string | null; vehicleId?: string | null; note?: string; payStatus?: any }, actor: string) {
    const msgs: string[] = [];
    let mailKind: string | null = null;
    await this.ds.transaction(async (m) => {
      if (ch.driverId !== undefined && ch.driverId !== b.driverId) {
        const d = ch.driverId ? await m.findOne(Driver, { where: { id: ch.driverId } }) : null;
        if (ch.driverId && !d) throw new BadRequestException('Driver not found');
        b.driverId = d?.id || null; msgs.push(d ? `Driver ${d.name} assigned` : 'Driver removed');
      }
      if (ch.vehicleId !== undefined && ch.vehicleId !== b.vehicleId) {
        const v = ch.vehicleId ? await m.findOne(Vehicle, { where: { id: ch.vehicleId } }) : null;
        if (ch.vehicleId && !v) throw new BadRequestException('Vehicle not found');
        b.vehicleId = v?.id || null; msgs.push(v ? `Vehicle ${v.plate} assigned` : 'Vehicle removed');
      }
      if (ch.status && ch.status !== b.status) {
        if (['Assigned', 'On trip'].includes(ch.status) && !b.driverId) throw new BadRequestException('Assign a driver first');
        if (b.status === 'Cancelled' && actor === 'customer') throw new BadRequestException('Booking already cancelled');
        const prev = b.status; b.status = ch.status;
        msgs.push(`Status changed from ${prev} to ${ch.status}${actor === 'customer' ? ' by customer' : ''}`);
        const d = b.driverId ? await m.findOne(Driver, { where: { id: b.driverId } }) : null;
        const v = b.vehicleId ? await m.findOne(Vehicle, { where: { id: b.vehicleId } }) : null;
        if (ch.status === 'On trip') { if (d) { d.status = 'On trip'; await m.save(d); } if (v) { v.status = 'On trip'; await m.save(v); } }
        if (['Completed', 'Cancelled'].includes(ch.status)) {
          if (d && d.status === 'On trip') { d.status = 'Available'; await m.save(d); }
          if (v && v.status === 'On trip') { v.status = 'Available'; await m.save(v); }
        }
        if (ch.status === 'Completed' && b.payMethod === 'cash' && b.payStatus === 'unpaid') { b.payStatus = 'paid'; msgs.push('Cash collected by driver'); }
        if (ch.status === 'Cancelled' && b.payStatus === 'paid') { b.payStatus = 'refund_due'; msgs.push('Refund due'); }
        if (ch.status === 'Cancelled' && b.payStatus === 'pending') b.payStatus = 'failed';
        mailKind = ch.status;
      }
      if (ch.payStatus && ch.payStatus !== b.payStatus) { msgs.push(`Payment marked ${ch.payStatus.replace('_', ' ')}`); b.payStatus = ch.payStatus; }
      if (ch.note) msgs.push(ch.note);
      await m.save(b);
      for (const msg of msgs) await m.save(m.create(BookingEvent, { bookingId: b.id, message: msg.slice(0, 300), actor }));
    });
    if (mailKind) this.notifyStatus(b, mailKind);
    else if (ch.driverId && b.status === 'Assigned') this.notifyStatus(b, 'Assigned');
    return b;
  }

  async refund(ref: string, actor: string) {
    const b = await this.bookings.findOne({ where: { ref } });
    if (!b) throw new NotFoundException('Booking not found');
    if (!['paid', 'refund_due'].includes(b.payStatus)) throw new BadRequestException('There is no online payment to refund');
    await this.payments.refund(b);
    b.payStatus = 'refunded'; await this.bookings.save(b);
    await this.addEvent(b, `Refunded ${b.total} ${b.currency} to the card`, actor);
    this.mail.send(b.email, `Refund for booking ${b.ref}`, `<p>Hi ${esc(b.name)},</p><p>We have refunded <b>${esc(b.total)} ${esc(b.currency)}</b> for booking <b>${esc(b.ref)}</b> to your card. Banks usually show it within 5–10 working days.</p>`);
    return this.get(ref);
  }

  async addEvent(b: Booking, message: string, actor = 'system') {
    await this.events.save(this.events.create({ bookingId: b.id, message: message.slice(0, 300), actor }));
  }

  /* ---------- dashboard ---------- */
  async stats() {
    const brand = await this.settings.brand(); const t = todayIn(brand.timezone || 'UTC');
    const d = (n: number) => addDaysStr(t, n);
    const sum = async (a: string, z: string) => {
      const r = await this.bookings.createQueryBuilder('b').select('count(*)', 'n').addSelect(`coalesce(sum(case when b.status <> 'Cancelled' then b.total else 0 end),0)`, 'rev').addSelect(`sum(case when b.status = 'Cancelled' then 1 else 0 end)`, 'cx')
        .where('b.date between :a and :z', { a, z }).getRawOne();
      return { n: Number(r.n), rev: Number(r.rev), cx: Number(r.cx || 0) };
    };
    const [cur, prev, m30] = await Promise.all([sum(d(-6), t), sum(d(-13), d(-7)), sum(d(-29), t)]);
    const days = await this.bookings.createQueryBuilder('b').select('b.date', 'date').addSelect('count(*)', 'n').addSelect('sum(b.total)', 'rev')
      .where('b.date between :a and :z', { a: d(-13), z: t }).andWhere(`b.status <> 'Cancelled'`).groupBy('b.date').getRawMany();
    const byDay = Object.fromEntries(days.map((r) => [typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10), { n: Number(r.n), rev: Number(r.rev) }]));
    const series = Array.from({ length: 14 }, (_, i) => { const k = d(i - 13); return { date: k, n: byDay[k]?.n || 0, rev: byDay[k]?.rev || 0 }; });
    const mix = await this.bookings.createQueryBuilder('b').select('b.category_name', 'name').addSelect('count(*)', 'n')
      .where('b.date between :a and :z', { a: d(-29), z: t }).andWhere(`b.status <> 'Cancelled'`).groupBy('b.category_name').orderBy('n', 'DESC').getRawMany();
    const upcoming = await this.bookings.createQueryBuilder('b').where('b.date >= :t', { t }).andWhere('b.status in (:...s)', { s: ['Pending', 'Confirmed', 'Assigned', 'On trip'] }).orderBy('b.date').addOrderBy('b.time').getMany();
    const [drivers, driversAvail, vehicles, vehiclesAvail] = await Promise.all([this.drivers.count(), this.drivers.count({ where: { status: 'Available' } }), this.vehicles.count(), this.vehicles.count({ where: { status: 'Available' } })]);
    const pending = await this.bookings.count({ where: { status: 'Pending' } });
    const refundsDue = await this.bookings.count({ where: { payStatus: 'refund_due' } });
    return {
      today: t, last7: cur, prev7: prev, cancelRate30: m30.n ? (m30.cx / m30.n) * 100 : 0, cancelled30: m30.cx, total30: m30.n,
      series, mix: mix.map((r) => ({ name: r.name, n: Number(r.n) })), upcomingCount: upcoming.length, unassigned: upcoming.filter((b) => !b.driverId).length,
      next: upcoming.slice(0, 8), drivers, driversAvail, vehicles, vehiclesAvail, pending, refundsDue,
    };
  }

  async csv(q: any) {
    const { items } = await this.list({ ...q, limit: 500 });
    const cols = ['ref', 'status', 'date', 'time', 'type', 'pickup', 'dropoff', 'km', 'hours', 'pax', 'bags', 'categoryName', 'total', 'currency', 'payMethod', 'payStatus', 'name', 'email', 'phone', 'flight', 'promo', 'createdAt'];
    const risky = /^(=|@|[+-][^\d\s(])/; // spreadsheet formula injection, but keep +971... phone numbers readable
    const cell = (v: any) => {
      let s = v instanceof Date ? v.toISOString() : String(v ?? '');
      if (risky.test(s)) s = "'" + s;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(','), ...items.map((b) => cols.map((c) => cell((b as any)[c])).join(','))].join('\n');
  }

  /* ---------- emails ---------- */
  private summary(b: Booking) {
    const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#6b717b">${k}</td><td style="padding:4px 0"><b>${v}</b></td></tr>`;
    return `<table cellpadding="0" cellspacing="0" style="margin:12px 0">${row('Reference', esc(b.ref))}${row('Pickup', esc(b.pickup))}${b.dropoff ? row('Drop-off', esc(b.dropoff)) : ''}${row('When', esc(b.date + ' ' + b.time))}${b.returnDate ? row('Return', esc(b.returnDate + ' ' + b.returnTime)) : ''}${b.hours ? row('Hours', String(b.hours)) : ''}${row('Vehicle', esc(b.categoryName))}${row('Guests', `${b.pax} · ${b.bags} bags`)}${row('Total', `${esc(b.total)} ${esc(b.currency)}`)}${row('Payment', b.payStatus === 'paid' ? 'Paid by card' : b.payMethod === 'cash' ? 'Pay the driver' : b.payMethod === 'account' ? 'Corporate account' : 'Card')}</table>`;
  }
  private manageLink(b: Booking) { return `${config.appUrl}/manage?ref=${encodeURIComponent(b.ref)}&email=${encodeURIComponent(b.email)}`; }

  private async notifyCreated(b: Booking) {
    const brand = await this.settings.brand();
    const paid = b.payStatus === 'paid';
    this.mail.send(b.email, `${paid ? 'Booking confirmed' : 'Booking received'}: ${b.ref}`,
      `<p>Hi ${esc(b.name)},</p><p>${paid ? 'Thank you, your payment was received and your ride is confirmed.' : 'Thank you for your booking. We will confirm it shortly.'}</p>${this.summary(b)}<p><a href="${this.manageLink(b)}">View or cancel your booking</a></p>`);
    if (brand.notifyEmail) this.mail.send(brand.notifyEmail, `New booking ${b.ref}: ${b.date} ${b.time}`, `<p>A new booking was made on the website.</p>${this.summary(b)}<p>Customer: ${esc(b.name)}, ${esc(b.phone)}, ${esc(b.email)}${b.flight ? ', flight ' + esc(b.flight) : ''}</p>${b.notes ? `<p>Note: ${esc(b.notes)}</p>` : ''}<p><a href="${config.appUrl}/admin/bookings">Open the dispatch portal</a></p>`, b.email);
  }

  private async notifyStatus(b: Booking, status: string) {
    try {
      if (status === 'Confirmed') this.mail.send(b.email, `Booking confirmed: ${b.ref}`, `<p>Hi ${esc(b.name)},</p><p>Your ride is confirmed.</p>${this.summary(b)}<p><a href="${this.manageLink(b)}">Manage your booking</a></p>`);
      if (status === 'Assigned') {
        const d = b.driverId ? await this.drivers.findOne({ where: { id: b.driverId } }) : null;
        const v = b.vehicleId ? await this.vehicles.findOne({ where: { id: b.vehicleId } }) : null;
        this.mail.send(b.email, `Your driver for ${b.ref}`, `<p>Hi ${esc(b.name)},</p><p>Your driver is <b>${esc(d?.name || 'assigned')}</b>${d?.phone ? `, phone ${esc(d.phone)}` : ''}.${v ? ` Vehicle: ${esc(v.color)} ${esc(v.model)}, plate <b>${esc(v.plate)}</b>.` : ''}</p>${this.summary(b)}`);
        if (d?.email) this.mail.send(d.email, `New trip ${b.ref}: ${b.date} ${b.time}`, `<p>Hi ${esc(d.name)}, you have a new trip.</p>${this.summary(b)}<p>Customer: ${esc(b.name)}, ${esc(b.phone)}${b.flight ? ', flight ' + esc(b.flight) : ''}</p>${b.notes ? `<p>Note: ${esc(b.notes)}</p>` : ''}<p><a href="${config.appUrl}/driver">Open your trips</a></p>`);
      }
      if (status === 'Cancelled') this.mail.send(b.email, `Booking cancelled: ${b.ref}`, `<p>Hi ${esc(b.name)},</p><p>Booking <b>${esc(b.ref)}</b> has been cancelled.${b.payStatus === 'refund_due' ? ' Your card payment will be refunded.' : ''}</p>`);
      if (status === 'Completed') this.mail.send(b.email, `Thanks for riding with us (${b.ref})`, `<p>Hi ${esc(b.name)},</p><p>Thank you for travelling with us. We hope to see you again soon.</p>`);
    } catch (e) { this.log.warn('notify failed ' + (e as Error).message); }
  }
}
