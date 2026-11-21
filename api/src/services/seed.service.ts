import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { config } from '../config';
import { Booking, BookingEvent, Category, Driver, Extra, Place, Promo, Setting, User, Vehicle } from '../entities';
import { DEFAULT_CONTENT, PRESETS, defaultBrand, defaultPricing, scaledCategories, scaledExtras } from './defaults';
import { quote } from '../pricing/quote';
import { todayIn, addDaysStr } from '../common';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private log = new Logger('Setup');
  constructor(private ds: DataSource, @InjectRepository(User) private users: Repository<User>) {}

  async onApplicationBootstrap() {
    const settings = this.ds.getRepository(Setting);
    const preset = PRESETS[config.region] || PRESETS.generic;
    if (!(await settings.findOne({ where: { key: 'brand' } }))) {
      this.log.log(`First start: loading the "${preset.label}" preset`);
      await settings.save([{ key: 'brand', value: defaultBrand(preset) }, { key: 'content', value: DEFAULT_CONTENT }, { key: 'pricing', value: defaultPricing(preset) }]);
      await this.ds.getRepository(Category).save(scaledCategories(preset.factor));
      await this.ds.getRepository(Extra).save(scaledExtras(preset.factor));
      await this.ds.getRepository(Place).save(preset.places.map(([name, type, lat, lng], i) => ({ name, type, lat, lng, sort: i })));
      await this.ds.getRepository(Promo).save([{ code: 'WELCOME10', kind: 'pct', value: 10, active: true, note: '10% off a first ride' }]);
    }
    if ((await this.users.count()) === 0) {
      const pass = config.adminPassword || randomBytes(9).toString('base64url');
      await this.users.save(this.users.create({ name: 'Administrator', email: config.adminEmail.toLowerCase(), passwordHash: await bcrypt.hash(pass, 10), role: 'admin' }));
      this.log.warn(`Admin account created: ${config.adminEmail}${config.adminPassword ? '' : ` with password ${pass} (change it after signing in)`}`);
    }
    if (config.seedDemo && (await this.ds.getRepository(Driver).count()) === 0) await this.seedDemo();
  }

  /** Replace places, rates, currency and tax with a region preset. Bookings, drivers and content are kept. */
  async applyPreset(key: string) {
    const p = PRESETS[key];
    if (!p) throw new Error('Unknown preset');
    await this.ds.transaction(async (m) => {
      const brand = (await m.findOne(Setting, { where: { key: 'brand' } }))?.value || defaultBrand(p);
      const pricing = (await m.findOne(Setting, { where: { key: 'pricing' } }))?.value || defaultPricing(p);
      Object.assign(brand, { city: p.city, currency: p.currency, locale: p.locale, timezone: p.timezone });
      Object.assign(pricing, { tax: p.tax, taxLabel: p.taxLabel, airportFee: defaultPricing(p).airportFee });
      await m.save(Setting, [{ key: 'brand', value: brand }, { key: 'pricing', value: pricing }]);
      await m.clear(Place);
      await m.save(Place, p.places.map(([name, type, lat, lng], i) => ({ name, type, lat, lng, sort: i })));
      const cats = await m.find(Category);
      const scaled = scaledCategories(p.factor);
      for (const c of cats) { const s = scaled.find((x) => x.name === c.name) || scaled.find((x) => x.type === c.type); if (s) Object.assign(c, { base: s.base, perKm: s.perKm, perHour: s.perHour, minFare: s.minFare }); }
      await m.save(Category, cats);
      const ex = await m.find(Extra), se = scaledExtras(p.factor);
      for (const e of ex) { const s = se.find((x) => x.name === e.name); if (s) e.price = s.price; }
      await m.save(Extra, ex);
    });
  }

  private async seedDemo() {
    this.log.log('Adding demo drivers, vehicles and bookings (SEED_DEMO=true)');
    const cats = await this.ds.getRepository(Category).find({ order: { sort: 'ASC' } });
    const drivers = await this.ds.getRepository(Driver).save(['Omar Haddad', 'Priya Nair', 'James Carter', 'Arjun Mehta', 'Fatima Zahra', 'Daniel Kim', 'Sofia Rossi', 'Kwame Mensah'].map((name, i) => ({ name, phone: `+00 50 210 ${3000 + i * 137}`, licence: `DL-${840000 + i * 7919}`, languages: ['English, Arabic', 'English, Tamil', 'English', 'English, Hindi', 'English, French', 'English, Korean', 'English, Italian', 'English'][i], rating: 4.6 + ((i * 7) % 5) / 10, status: i === 7 ? 'Off duty' : 'Available' })));
    const models: [string, number][] = [['Toyota Camry', 0], ['Hyundai Sonata', 0], ['Lexus ES 300h', 1], ['Toyota Land Cruiser', 2], ['GMC Yukon', 2], ['Kia Carnival', 3], ['Mercedes V-Class', 3], ['Mercedes S-Class', 4], ['Toyota Coaster', 5]];
    const vehicles = await this.ds.getRepository(Vehicle).save(models.map(([model, ci], i) => ({ plate: `${'ABCDEKLMN'[i]} ${20000 + i * 3571}`, model, categoryId: cats[ci]?.id || null, color: ['White', 'Silver', 'Black', 'White', 'Black', 'Silver', 'Black', 'Black', 'White'][i], year: 2022 + (i % 4), status: 'Available' })));
    const places = await this.ds.getRepository(Place).find();
    if (places.length < 2) return;
    const settings = this.ds.getRepository(Setting);
    const brand = (await settings.findOne({ where: { key: 'brand' } })).value, rules = (await settings.findOne({ where: { key: 'pricing' } })).value;
    const extras = await this.ds.getRepository(Extra).find();
    const today = todayIn(brand.timezone);
    let seed = 42; const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
    const people = [['Emma Wilson', 'emma.wilson'], ['Rahul Sharma', 'rahul.s'], ['Li Wei', 'liwei'], ['Ahmed Al Mansoori', 'ahmed.m'], ['Sarah Johnson', 'sarahj'], ['Carlos Mendes', 'carlos.mendes'], ['Aisha Khan', 'aisha.k'], ['Meera Iyer', 'meera.iyer']];
    const { roadKm } = await import('../pricing/quote');
    const rows: Partial<Booking>[] = [];
    for (let d = -20; d <= 6; d++) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const air = places.filter((p) => p.type === 'airport'), oth = places.filter((p) => p.type !== 'airport');
        const type = pick(['oneway', 'oneway', 'airport', 'round', 'hourly'] as const);
        let a = pick(oth), b = pick(oth.filter((p) => p !== a));
        if (type === 'airport' && air.length) { if (r() < 0.5) a = pick(air); else b = pick(air); }
        const pax = 1 + Math.floor(r() * 4), cat = pick(cats.filter((c) => c.seats >= pax && c.type !== 'bus'));
        const time = `${String(6 + Math.floor(r() * 16)).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`;
        const km = type === 'hourly' ? 0 : roadKm(a as any, b as any), hours = type === 'hourly' ? 2 + Math.floor(r() * 4) : 0;
        const q = quote(rules, cat, { type, km, hours, time, airport: a.type === 'airport' || b.type === 'airport', extras: {}, promo: '' }, extras, []);
        const status = d < 0 ? (r() < 0.88 ? 'Completed' : 'Cancelled') : d === 0 ? pick(['Completed', 'Assigned', 'Confirmed']) : pick(['Pending', 'Confirmed', 'Confirmed', 'Assigned']);
        const drv = ['Assigned', 'On trip', 'Completed'].includes(status) ? pick(drivers.slice(0, 7)) : null;
        const veh = drv ? vehicles.find((v) => v.categoryId === cat.id) || null : null;
        const [name, mail] = pick(people);
        const date = addDaysStr(today, d);
        rows.push({ ref: 'DM-' + Math.floor(r() * 1e9).toString(36).toUpperCase().padStart(6, '0').slice(0, 6), type, pickup: a.name, dropoff: type === 'hourly' ? '' : b.name, date, time, returnDate: type === 'round' ? date : null, returnTime: type === 'round' ? '20:00' : null, hours, km, kmSource: 'places', pax, bags: Math.min(cat.bags, 1), categoryId: cat.id, categoryName: cat.name, extras: {}, promo: '', lines: q.lines, total: q.total, currency: brand.currency, name, email: `${mail}@example.com`, phone: `+00 50 ${1000000 + Math.floor(r() * 8999999)}`, flight: type === 'airport' ? pick(['EK 203', 'BA 107', 'AI 937']) : '', notes: '', payMethod: pick(['card', 'cash'] as const), payStatus: 'unpaid', status, driverId: drv?.id || null, vehicleId: veh?.id || null, source: 'website' });
      }
    }
    const saved = await this.ds.getRepository(Booking).save(rows.filter((x, i, arr) => arr.findIndex((y) => y.ref === x.ref) === i));
    await this.ds.getRepository(BookingEvent).save(saved.map((b) => ({ bookingId: b.id, message: 'Demo booking', actor: 'system' })));
  }
}
