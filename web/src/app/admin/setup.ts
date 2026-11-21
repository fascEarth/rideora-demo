import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api';
import { Site, TYPE_NAMES } from '../core/site';
import { Icon, Mark, Ui } from '../core/ui';
import { Col, Crud, CrudSource, Field, restSource } from './crud';
import { Head } from './shell';

const ICONS: [string, string][] = [['plane', 'Plane'], ['city', 'City'], ['clock', 'Clock'], ['road', 'Road'], ['brief', 'Briefcase'], ['group', 'Group'], ['shield', 'Shield'], ['tag', 'Price tag'], ['headset', 'Support'], ['car', 'Car'], ['pin', 'Pin'], ['check', 'Tick']];
const isAdmin = (api: Api) => api.user()?.role === 'admin';

/* ================= vehicles / drivers / places / promos / users ================= */
@Component({
  selector: 'app-vehicles', imports: [Head, Crud],
  template: `<app-head title="Vehicles" sub="Your fleet. Assign a category so dispatch can match cars to bookings." />
    @if (ready()) { <app-crud title="Fleet" noun="vehicle" [cols]="cols" [fields]="fields" [source]="src" [canEdit]="admin" [defaults]="{ status: 'Available' }" /> }`,
})
export class VehiclesPage implements OnInit {
  private api = inject(Api); admin = isAdmin(this.api); src = restSource(this.api, 'vehicles'); cats = signal<any[]>([]); ready = signal(false);
  cols: Col[] = [{ k: 'plate', label: 'Plate' }, { k: 'model', label: 'Model', sub: (v) => [v.color, v.year].filter(Boolean).join(' · ') }, { k: 'categoryId', label: 'Category', fmt: (v) => this.cats().find((c) => c.id === v.categoryId)?.name || 'None' }, { k: 'status', label: 'Status', badge: (v) => v.status }];
  fields: Field[] = [{ k: 'plate', label: 'Plate number', type: 'text' }, { k: 'model', label: 'Make and model', type: 'text' }, { k: 'categoryId', label: 'Category', type: 'select', options: () => this.cats().map((c) => [c.id, c.name] as [string, string]) },
    { k: 'color', label: 'Colour', type: 'text' }, { k: 'year', label: 'Year', type: 'number' }, { k: 'status', label: 'Status', type: 'select', options: () => [['Available', 'Available'], ['On trip', 'On trip'], ['Maintenance', 'Maintenance']] }];
  async ngOnInit() { this.cats.set(await this.api.get('admin/categories')); this.ready.set(true); }
}

@Component({
  selector: 'app-drivers', imports: [Head, Crud],
  template: `<app-head title="Drivers" sub="Give a driver a login under Staff logins so they can see their trips on their phone." />
    <app-crud title="Drivers" noun="driver" [cols]="cols" [fields]="fields" [source]="src" [canEdit]="admin" [defaults]="{ status: 'Available', rating: 5 }" />`,
})
export class DriversPage {
  private api = inject(Api); admin = isAdmin(this.api); src = restSource(this.api, 'drivers');
  cols: Col[] = [{ k: 'name', label: 'Name', sub: (d) => d.languages }, { k: 'phone', label: 'Phone', sub: (d) => d.email }, { k: 'licence', label: 'Licence' }, { k: 'rating', label: 'Rating', fmt: (d) => '★ ' + d.rating }, { k: 'status', label: 'Status', badge: (d) => d.status }];
  fields: Field[] = [{ k: 'name', label: 'Full name', type: 'text' }, { k: 'phone', label: 'Phone', type: 'text' }, { k: 'email', label: 'Email (for trip alerts)', type: 'text' }, { k: 'licence', label: 'Licence number', type: 'text' },
    { k: 'languages', label: 'Languages', type: 'text' }, { k: 'rating', label: 'Rating (0–5)', type: 'number' }, { k: 'status', label: 'Status', type: 'select', options: () => [['Available', 'Available'], ['On trip', 'On trip'], ['Off duty', 'Off duty']] }];
}

@Component({
  selector: 'app-places', imports: [Head, Crud],
  template: `<app-head title="Places" sub="Suggestions in the booking form and the coverage section. With coordinates, distances are calculated automatically." />
    <app-crud title="Saved places" noun="place" hint="Tip: in Google Maps, right-click a spot to copy its latitude and longitude." [cols]="cols" [fields]="fields" [source]="src" [defaults]="{ type: 'landmark', sort: 0 }" />`,
})
export class PlacesPage {
  private api = inject(Api); src = restSource(this.api, 'places');
  cols: Col[] = [{ k: 'name', label: 'Place' }, { k: 'type', label: 'Type' }, { k: 'lat', label: 'Coordinates', num: true, fmt: (p) => (p.lat != null ? `${(+p.lat).toFixed(4)}, ${(+p.lng).toFixed(4)}` : 'Not set') }];
  fields: Field[] = [{ k: 'name', label: 'Name', type: 'text', wide: true }, { k: 'type', label: 'Type', type: 'select', options: () => [['airport', 'Airport'], ['station', 'Station'], ['port', 'Port'], ['district', 'District'], ['landmark', 'Landmark'], ['hotel', 'Hotel'], ['city', 'City']] },
    { k: 'sort', label: 'Order', type: 'number' }, { k: 'lat', label: 'Latitude', type: 'number' }, { k: 'lng', label: 'Longitude', type: 'number' }];
}

@Component({
  selector: 'app-promos', imports: [Head, Crud],
  template: `<app-head title="Promotions" sub="Customers enter codes at checkout. Inactive, expired or used-up codes are rejected." />
    <app-crud title="Promo codes" noun="promo code" [cols]="cols" [fields]="fields" [source]="src" [defaults]="{ kind: 'pct', value: 10 }" />`,
})
export class PromosPage {
  private api = inject(Api); site = inject(Site); src = restSource(this.api, 'promos');
  cols: Col[] = [{ k: 'code', label: 'Code', sub: (p) => p.note }, { k: 'value', label: 'Discount', num: true, fmt: (p) => (p.kind === 'pct' ? p.value + '%' : this.site.money(p.value)) },
    { k: 'validUntil', label: 'Limits', fmt: (p) => [p.validUntil ? 'until ' + p.validUntil : '', p.maxUses ? `max ${p.maxUses} uses` : ''].filter(Boolean).join(', ') || 'None' }, { k: 'active', label: 'Status', badge: (p) => (p.active ? 'Active' : 'Inactive') }];
  fields: Field[] = [{ k: 'code', label: 'Code', type: 'text' }, { k: 'kind', label: 'Type', type: 'select', options: () => [['pct', 'Percentage'], ['flat', 'Fixed amount']] }, { k: 'value', label: 'Value', type: 'number' },
    { k: 'maxUses', label: 'Maximum uses (optional)', type: 'number' }, { k: 'validUntil', label: 'Valid until (optional)', type: 'date' }, { k: 'note', label: 'Internal note', type: 'text' }, { k: 'active', label: 'Active', type: 'check' }];
  constructor() { this.site.load().catch(() => {}); }
}

@Component({
  selector: 'app-users', imports: [Head, Crud],
  template: `<app-head title="Staff logins" sub="Admins manage everything. Dispatchers handle bookings. Drivers see only their own trips at /driver." />
    @if (ready()) { <app-crud title="Logins" noun="login" [cols]="cols" [fields]="fields" [source]="src" [prepare]="prep" [defaults]="{ role: 'dispatcher', active: true, driverId: null }" /> }`,
})
export class UsersPage implements OnInit {
  private api = inject(Api); site = inject(Site); src = restSource(this.api, 'users'); drivers = signal<any[]>([]); ready = signal(false);
  cols: Col[] = [{ k: 'name', label: 'Name', sub: (u) => u.email }, { k: 'role', label: 'Role', fmt: (u) => u.role + (u.driverId ? ' · ' + (this.drivers().find((d) => d.id === u.driverId)?.name || '') : '') },
    { k: 'lastLoginAt', label: 'Last sign-in', fmt: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(this.site.brand().locale || 'en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never') }, { k: 'active', label: 'Status', badge: (u) => (u.active ? 'Active' : 'Inactive') }];
  fields: Field[] = [{ k: 'name', label: 'Name', type: 'text' }, { k: 'email', label: 'Email', type: 'email' }, { k: 'role', label: 'Role', type: 'select', options: () => [['admin', 'Admin'], ['dispatcher', 'Dispatcher'], ['driver', 'Driver']] },
    { k: 'driverId', label: 'Driver (for driver logins)', type: 'select', options: () => [['', 'Not a driver'], ...this.drivers().map((d) => [d.id, d.name] as [string, string])] },
    { k: 'password', label: 'Password', type: 'password', hint: 'At least 8 characters. Leave empty to keep the current one.' }, { k: 'active', label: 'Can sign in', type: 'check' }];
  prep = (v: any) => { const o = { ...v, driverId: v.driverId || null }; if (!o.password) delete o.password; return o; };
  async ngOnInit() { this.drivers.set(await this.api.get('admin/drivers')); this.ready.set(true); }
}

/* ================= fleet & pricing ================= */
@Component({
  selector: 'app-pricing', imports: [Head, Crud, FormsModule],
  template: `<app-head title="Fleet & pricing" [sub]="'Amounts in ' + site.brand().currency" />
  @if (p(); as p) { <div class="card"><h2>Fare rules</h2><p class="sub">Applied to every quote on the website and in the CMS.</p>
    <form class="form" (ngSubmit)="save()" novalidate>
      <label class="fl"><span>Tax name</span><input name="taxLabel" [(ngModel)]="p.taxLabel"></label><label class="fl"><span>Tax %</span><input type="number" name="tax" [(ngModel)]="p.tax"></label>
      <label class="fl"><span>Airport fee</span><input type="number" name="airportFee" [(ngModel)]="p.airportFee"></label><label class="fl"><span>Night surcharge %</span><input type="number" name="nightPct" [(ngModel)]="p.nightPct"></label>
      <label class="fl"><span>Night starts (hour 0–23)</span><input type="number" name="nightStart" [(ngModel)]="p.nightStart"></label><label class="fl"><span>Night ends (hour 0–23)</span><input type="number" name="nightEnd" [(ngModel)]="p.nightEnd"></label>
      <label class="fl"><span>Round-trip discount %</span><input type="number" name="roundDisc" [(ngModel)]="p.roundDisc"></label><label class="fl"><span>Minimum hours (hourly hire)</span><input type="number" name="minHours" [(ngModel)]="p.minHours"></label>
      <label class="fl"><span>Km included per hour</span><input type="number" name="kmPerHour" [(ngModel)]="p.kmPerHour"></label><label class="fl"><span>Online cancellation until (hours before pickup)</span><input type="number" name="cancelHours" [(ngModel)]="p.cancelHours"></label>
      <label class="fl"><span>Minimum notice for online bookings (minutes)</span><input type="number" name="minNoticeMinutes" [(ngModel)]="p.minNoticeMinutes"></label><span></span>
      <label class="chk"><input type="checkbox" name="payCard" [(ngModel)]="p.payCard"><span>Offer card payment online</span></label><label class="chk"><input type="checkbox" name="payCash" [(ngModel)]="p.payCash"><span>Offer "Pay the driver"</span></label>
      <label class="chk"><input type="checkbox" name="payAccount" [(ngModel)]="p.payAccount"><span>Offer "Corporate account"</span></label>
      <div class="wide"><button class="btn dark" type="submit">Save fare rules</button></div></form></div> }
  <div class="mt"></div>
  <app-crud title="Vehicle categories and rates" noun="category" hint="Fare = base + per km × distance, never below the minimum. Hourly trips use the hourly rate." [cols]="catCols" [fields]="catFields" [source]="cats" [defaults]="{ type: 'sedan', seats: 4, bags: 2, active: true, sort: 0 }" />
  <div class="mt"></div>
  <app-crud title="Extras" noun="extra" [cols]="exCols" [fields]="exFields" [source]="extras" [defaults]="{ active: true }" />
  <div class="card mt"><h2>Fare check</h2><p class="sub">Quote any trip with the current rules, without saving a booking.</p>
    <form class="form" (ngSubmit)="check()" novalidate>
      <label class="fl"><span>Trip type</span><select name="type" [(ngModel)]="fc.type">@for (k of typeKeys; track k) {<option [value]="k">{{ types[k] }}</option>}</select></label>
      <label class="fl"><span>Pickup</span><input name="pickup" list="pplc" [(ngModel)]="fc.pickup"></label>
      <label class="fl"><span>Drop-off</span><input name="dropoff" list="pplc" [(ngModel)]="fc.dropoff"></label>
      <label class="fl"><span>Pickup time</span><input type="time" name="time" [(ngModel)]="fc.time"></label>
      <datalist id="pplc">@for (x of site.data()?.places || []; track x.id) {<option [value]="x.name"></option>}</datalist>
      <div class="wide"><button class="btn ghost" type="submit">Calculate</button></div></form>
    @if (fcErr()) { <p class="err">{{ fcErr() }}</p> }
    @if (fcRes(); as r) { <p class="note">{{ r.km }} km ({{ r.kmSource }})</p><table class="tbl"><thead><tr><th>Category</th><th class="num">Total</th></tr></thead><tbody>@for (o of r.options; track o.category.id) {<tr><td>{{ o.category.name }}<small>{{ breakdown(o) }}</small></td><td class="num">{{ site.money(o.total) }}</td></tr>}</tbody></table> }
  </div>`,
})
export class PricingPage implements OnInit {
  private api = inject(Api); private ui = inject(Ui); site = inject(Site);
  p = signal<any>(null);
  cats: CrudSource = restSource(this.api, 'categories'); extras: CrudSource = restSource(this.api, 'extras');
  types = TYPE_NAMES; typeKeys = Object.keys(TYPE_NAMES);
  fc: any = { type: 'oneway', pickup: '', dropoff: '', time: '14:00' }; fcRes = signal<any>(null); fcErr = signal('');
  catCols: Col[] = [{ k: 'name', label: 'Category', sub: (c) => `${c.seats} guests · ${c.bags} bags` }, { k: 'base', label: 'Base', num: true, fmt: (c) => this.site.money(c.base) }, { k: 'perKm', label: 'Per km', num: true, fmt: (c) => this.site.money(c.perKm) },
    { k: 'perHour', label: 'Per hour', num: true, fmt: (c) => this.site.money(c.perHour) }, { k: 'minFare', label: 'Minimum', num: true, fmt: (c) => this.site.money(c.minFare) }, { k: 'active', label: 'Status', badge: (c) => (c.active ? 'Active' : 'Inactive') }];
  catFields: Field[] = [{ k: 'name', label: 'Name', type: 'text' }, { k: 'type', label: 'Illustration', type: 'select', options: () => [['sedan', 'Sedan'], ['lux', 'Executive sedan'], ['suv', 'SUV'], ['van', 'Van / MPV'], ['bus', 'Minibus'], ['ev', 'Electric']] },
    { k: 'seats', label: 'Guests', type: 'number' }, { k: 'bags', label: 'Bags', type: 'number' }, { k: 'base', label: 'Base fare', type: 'number' }, { k: 'perKm', label: 'Per km', type: 'number' },
    { k: 'perHour', label: 'Per hour', type: 'number' }, { k: 'minFare', label: 'Minimum fare', type: 'number' }, { k: 'sort', label: 'Order', type: 'number' }, { k: 'description', label: 'Description', type: 'textarea' }, { k: 'active', label: 'Show on website', type: 'check' }];
  exCols: Col[] = [{ k: 'name', label: 'Extra' }, { k: 'price', label: 'Price', num: true, fmt: (x) => this.site.money(x.price) }, { k: 'active', label: 'Status', badge: (x) => (x.active ? 'Active' : 'Inactive') }];
  exFields: Field[] = [{ k: 'name', label: 'Name', type: 'text', wide: true }, { k: 'price', label: 'Price', type: 'number' }, { k: 'active', label: 'Offer on website', type: 'check' }];
  breakdown = (o: any) => o.lines.map((l: any) => `${l[0]} ${this.site.money(l[1])}`).join(' · ');
  async ngOnInit() { this.site.load().catch(() => {}); const s = await this.api.get('admin/settings'); this.p.set(s.pricing); }
  async save() {
    const p = this.p(), body: any = {};
    for (const [k, v] of Object.entries(p)) body[k] = typeof v === 'string' && k !== 'taxLabel' ? Number(v) : v;
    try { this.p.set(await this.api.put('admin/settings/pricing', body)); this.ui.toast('Fare rules saved'); } catch (e: any) { this.ui.toast(e.message); }
  }
  async check() {
    this.fcErr.set(''); this.fcRes.set(null);
    const t = this.fc, d = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    try { this.fcRes.set(await this.api.post('admin/quote', { type: t.type, pickup: t.pickup, dropoff: t.type === 'hourly' ? undefined : t.dropoff, hours: t.type === 'hourly' ? 3 : undefined, date: d, time: t.time, returnDate: t.type === 'round' ? d : undefined, returnTime: t.type === 'round' ? '23:00' : undefined, pax: 1, bags: 0 })); }
    catch (e: any) { this.fcErr.set(e.message); }
  }
}

/* ================= website content ================= */
const jsonList = (api: Api, key: 'features' | 'services' | 'faq', get: () => any, set: (c: any) => void): CrudSource => ({
  list: async () => (get()?.[key] || []).map((x: any, i: number) => ({ ...x, _i: i })),
  save: async (row, v) => { const arr = [...(get()[key] || [])].map(({ _i, ...x }: any) => x); if (row) arr[row._i] = v; else arr.push(v); set(await api.put('admin/settings/content', { ...get(), [key]: arr })); },
  remove: async (row) => { const arr = [...(get()[key] || [])].filter((_: any, i: number) => i !== row._i); set(await api.put('admin/settings/content', { ...get(), [key]: arr })); },
});

@Component({
  selector: 'app-content', imports: [Head, Crud, FormsModule],
  template: `<app-head title="Website content" sub="Everything a visitor reads"><a class="btn ghost sm" href="/" target="_blank">Preview website</a></app-head>
  @if (c(); as c) {
    <div class="card"><h2>Hero, about and search engines</h2><form class="form" (ngSubmit)="save()" novalidate>
      <label class="fl wide"><span>Headline</span><input name="heroTitle" [(ngModel)]="c.heroTitle"></label>
      <label class="fl wide"><span>Sub-headline</span><textarea name="heroSub" rows="2" [(ngModel)]="c.heroSub"></textarea></label>
      <label class="fl wide"><span>About text (services section)</span><textarea name="about" rows="3" [(ngModel)]="c.about"></textarea></label>
      <label class="fl wide"><span>Search engine description</span><input name="meta" [(ngModel)]="c.metaDescription"></label>
      <label class="fl wide"><span>Terms of booking</span><textarea name="terms" rows="5" [(ngModel)]="c.terms"></textarea></label>
      <div class="wide"><button class="btn dark" type="submit">Save content</button></div></form></div>
    <div class="mt"></div><app-crud title="Highlights" noun="highlight" [cols]="fCols" [fields]="fFields" [source]="features" [defaults]="{ icon: 'check' }" />
    <div class="mt"></div><app-crud title="Services" noun="service" [cols]="fCols" [fields]="sFields" [source]="services" [defaults]="{ icon: 'car' }" />
    <div class="mt"></div><app-crud title="FAQ" noun="question" [cols]="qCols" [fields]="qFields" [source]="faq" />
  }`,
})
export class ContentPage implements OnInit {
  private api = inject(Api); private ui = inject(Ui); private site = inject(Site);
  c = signal<any>(null);
  private get = () => this.c(); private set = (v: any) => { this.c.set(v); this.site.load(true).catch(() => {}); };
  features = jsonList(this.api, 'features', this.get, this.set); services = jsonList(this.api, 'services', this.get, this.set); faq = jsonList(this.api, 'faq', this.get, this.set);
  fCols: Col[] = [{ k: 't', label: 'Title', sub: (x) => x.d }]; qCols: Col[] = [{ k: 'q', label: 'Question', sub: (x) => x.a }];
  fFields: Field[] = [{ k: 'icon', label: 'Icon', type: 'select', options: () => ICONS }, { k: 't', label: 'Title', type: 'text' }, { k: 'd', label: 'Text', type: 'textarea' }];
  sFields: Field[] = this.fFields;
  qFields: Field[] = [{ k: 'q', label: 'Question', type: 'text', wide: true }, { k: 'a', label: 'Answer', type: 'textarea' }];
  async ngOnInit() { this.c.set((await this.api.get('admin/settings')).content); }
  async save() { try { this.set(await this.api.put('admin/settings/content', this.c())); this.ui.toast('Content saved'); } catch (e: any) { this.ui.toast(e.message); } }
}

/* ================= branding ================= */
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'INR', 'LKR', 'NPR', 'BDT', 'PKR', 'SGD', 'MYR', 'THB', 'IDR', 'PHP', 'AUD', 'NZD', 'CAD', 'ZAR', 'NGN', 'KES', 'EGP', 'TRY', 'JPY', 'CHF'];
const LOCALES = ['en-US', 'en-GB', 'en-AE', 'en-IN', 'en-SG', 'en-AU', 'en-CA', 'en-ZA', 'ar-AE', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'ja-JP'];

@Component({
  selector: 'app-brand', imports: [Head, FormsModule, Mark],
  template: `<app-head title="Branding" sub="Make the site your own: name, colour, contacts, currency and time zone" />
  @if (b(); as b) { <div class="two"><div class="card"><h2>Business identity</h2><form class="form" (ngSubmit)="save()" novalidate>
    <label class="fl"><span>Business name</span><input name="name" [(ngModel)]="b.name"></label><label class="fl"><span>Tagline</span><input name="tagline" [(ngModel)]="b.tagline"></label>
    <label class="fl"><span>Brand colour</span><input type="color" name="primary" [(ngModel)]="b.primary" (ngModelChange)="site.applyBrand(b)"></label><label class="fl"><span>Main city</span><input name="city" [(ngModel)]="b.city"></label>
    <label class="fl"><span>Phone</span><input name="phone" [(ngModel)]="b.phone"></label><label class="fl"><span>WhatsApp</span><input name="whatsapp" [(ngModel)]="b.whatsapp"></label>
    <label class="fl"><span>Public email</span><input name="email" [(ngModel)]="b.email"></label><label class="fl"><span>Send new booking alerts to</span><input name="notifyEmail" [(ngModel)]="b.notifyEmail" placeholder="dispatch@yourcompany.com"></label>
    <label class="fl wide"><span>Address</span><input name="address" [(ngModel)]="b.address"></label>
    <label class="fl"><span>Currency</span><select name="currency" [(ngModel)]="b.currency">@for (c of currencies; track c) {<option>{{ c }}</option>}</select></label>
    <label class="fl"><span>Number format</span><select name="locale" [(ngModel)]="b.locale">@for (l of locales; track l) {<option>{{ l }}</option>}</select></label>
    <label class="fl wide"><span>Time zone</span><select name="timezone" [(ngModel)]="b.timezone">@for (z of zones; track z) {<option>{{ z }}</option>}</select></label>
    <div class="wide"><button class="btn dark" type="submit">Save branding</button></div></form></div>
    <div><div class="card"><h2>Preview</h2><div class="prev"><div class="ph"><span class="brand" style="font-size:18px"><app-mark />{{ b.name }}</span><p style="margin-top:10px;font-weight:700">{{ b.tagline }}</p></div>
      <div class="pb"><span class="btn p sm">Primary</span><span class="btn dark sm">Book a ride</span><span class="badge s-Confirmed">Confirmed</span><b>{{ sample(b) }}</b></div></div></div>
      <div class="card"><h2>Region preset</h2><p class="sub">Load ready-made places, rates, currency, tax and time zone for a market. Bookings, drivers and website content are kept.</p>
        <div class="presets">@for (p of presets(); track p.key) { <button class="btn ghost sm" (click)="preset(p)">{{ p.label }}</button> }</div></div></div></div> }`,
})
export class BrandPage implements OnInit {
  private api = inject(Api); private ui = inject(Ui); site = inject(Site);
  b = signal<any>(null); presets = signal<any[]>([]);
  currencies = CURRENCIES; locales = LOCALES;
  zones: string[] = (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('timeZone') : ['UTC', 'Asia/Dubai', 'Asia/Kolkata', 'Europe/London'];
  sample = (b: any) => { try { return new Intl.NumberFormat(b.locale, { style: 'currency', currency: b.currency }).format(1234.5); } catch { return ''; } };
  async ngOnInit() { const s = await this.api.get('admin/settings'); this.b.set(s.brand); this.presets.set(s.presets); if (!this.zones.includes(s.brand.timezone)) this.zones = [s.brand.timezone, ...this.zones]; }
  async save() { try { this.b.set(await this.api.put('admin/settings/brand', this.b())); await this.site.load(true); this.ui.toast('Branding saved'); } catch (e: any) { this.ui.toast(e.message); } }
  async preset(p: any) {
    if (!(await this.ui.confirm(`Load the ${p.label} preset? Places, rates, extras prices, currency, tax and time zone will be replaced.`, 'Load preset'))) return;
    try { const s = await this.api.post('admin/settings/preset', { key: p.key }); this.b.set(s.brand); await this.site.load(true); this.ui.toast('Preset loaded'); } catch (e: any) { this.ui.toast(e.message); }
  }
}

/* ================= settings ================= */
@Component({
  selector: 'app-settings', imports: [Head, FormsModule],
  template: `<app-head title="Settings" />
  @if (st(); as s) { <div class="card"><h2>Connected services</h2><p class="sub">Set on the server in the .env file. See DEPLOY.md.</p>
    <table class="tbl"><tbody>
      <tr><td>Website address</td><td>{{ s.appUrl }}</td></tr>
      <tr><td>Online card payments</td><td>{{ s.payments === 'none' ? 'Not set up' : s.payments === 'razorpay' ? 'Razorpay' : 'Stripe' }}</td></tr>
      <tr><td>Email notifications</td><td>{{ s.email ? 'On' : 'Not set up' }} @if (s.email) { <button class="lnk" (click)="testEmail()">Send me a test</button> }</td></tr>
      <tr><td>Distances</td><td>{{ s.maps ? 'Google Maps' : 'Saved places, otherwise customer estimate' }}</td></tr></tbody></table></div> }
  <div class="card"><h2>Change my password</h2><form class="form" (ngSubmit)="pw()" novalidate>
    <label class="fl"><span>Current password</span><input type="password" name="cur" [(ngModel)]="cur" autocomplete="current-password"></label>
    <label class="fl"><span>New password</span><input type="password" name="next" [(ngModel)]="next" autocomplete="new-password"></label>
    <div class="wide"><button class="btn dark" type="submit">Update password</button></div></form></div>`,
})
export class SettingsPage implements OnInit {
  private api = inject(Api); private ui = inject(Ui);
  st = signal<any>(null); cur = ''; next = '';
  async ngOnInit() { this.st.set((await this.api.get('admin/settings')).status); }
  async testEmail() { try { await this.api.post('admin/settings/test-email'); this.ui.toast('Test email sent to your address'); } catch (e: any) { this.ui.toast(e.message); } }
  async pw() { try { await this.api.post('auth/password', { current: this.cur, next: this.next }); this.cur = this.next = ''; this.ui.toast('Password updated'); } catch (e: any) { this.ui.toast(e.message); } }
}
