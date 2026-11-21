import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { PAY_NAMES, PAY_STATUS, STATUSES, Site, TYPE_NAMES } from '../core/site';
import { Badge, Icon, Ui } from '../core/ui';
import { Head } from './shell';

/* ================= booking detail dialog ================= */
@Component({
  selector: 'app-booking-detail',
  imports: [FormsModule, Badge, Icon],
  template: `<div class="md" (click)="closed.emit(changed)"><div class="md-c wide" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
    @if (!b()) { <div class="loading"><span class="spin"></span></div> } @else {
    <div class="md-h"><div><h3>{{ b().ref }} <app-badge [value]="b().status" /></h3><p class="note" style="margin:4px 0 0">{{ types[b().type] }} · booked {{ when(b().createdAt) }} via {{ b().source }}</p></div>
      <button class="x" (click)="closed.emit(changed)" aria-label="Close"><app-icon name="x" /></button></div>
    @if (err()) { <p class="err">{{ err() }}</p> }
    <div class="drawer-grid"><div>
      <dl class="kv"><dt>From</dt><dd>{{ b().pickup }}</dd>@if (b().dropoff) {<dt>To</dt><dd>{{ b().dropoff }}</dd>}
        <dt>When</dt><dd>{{ site.date(b().date, b().time) }}@if (b().returnDate) { · return {{ site.date(b().returnDate, b().returnTime) }} }@if (b().hours) { · {{ b().hours }} h }</dd>
        <dt>Distance</dt><dd>{{ b().km }} km ({{ b().kmSource === 'maps' ? 'maps' : b().kmSource === 'places' ? 'saved places' : 'customer estimate, check it' }})</dd>
        <dt>Vehicle</dt><dd>{{ b().categoryName }}</dd><dt>Guests</dt><dd>{{ b().pax }} guest{{ b().pax > 1 ? 's' : '' }} · {{ b().bags }} bag{{ b().bags === 1 ? '' : 's' }}</dd>
        <dt>Customer</dt><dd>{{ b().name }}</dd><dt>Phone</dt><dd><a [href]="'tel:' + b().phone">{{ b().phone }}</a> · <a [href]="'https://wa.me/' + digits(b().phone)" target="_blank" rel="noopener">WhatsApp</a></dd>
        <dt>Email</dt><dd><a [href]="'mailto:' + b().email">{{ b().email }}</a></dd>@if (b().flight) {<dt>Flight</dt><dd>{{ b().flight }}</dd>}@if (b().notes) {<dt>Note</dt><dd>{{ b().notes }}</dd>}</dl>
      <p class="h4">History</p>@for (e of b().events; track e.id) { <div class="bl"><span>{{ e.message }} <span class="muted">· {{ e.actor }}</span></span><span class="muted">{{ when(e.at) }}</span></div> }
    </div><div>
      <form class="form" style="grid-template-columns:1fr" (ngSubmit)="save()" novalidate>
        <label class="fl"><span>Status</span><select name="status" [(ngModel)]="f.status">@for (s of statuses; track s) {<option>{{ s }}</option>}</select></label>
        <label class="fl"><span>Driver</span><select name="driver" [(ngModel)]="f.driverId"><option [ngValue]="null">Unassigned</option>@for (d of drivers(); track d.id) {<option [ngValue]="d.id">{{ d.name }} · {{ d.status }}</option>}</select></label>
        <label class="fl"><span>Vehicle</span><select name="vehicle" [(ngModel)]="f.vehicleId"><option [ngValue]="null">Unassigned</option>@for (v of fitVehicles(); track v.id) {<option [ngValue]="v.id">{{ v.model }} · {{ v.plate }} · {{ v.status }}</option>}</select></label>
        <label class="fl"><span>Add a note to the history</span><input name="note" [(ngModel)]="f.note" placeholder="e.g. Called the customer"></label>
        <button class="btn dark" type="submit" [disabled]="busy()">Save changes</button></form>
      <div class="sum mt" style="position:static"><h3>Fare</h3>@for (l of b().lines; track $index) {<div class="bl"><span>{{ l[0] }}</span><span>{{ site.money(l[1], b().currency) }}</span></div>}
        <div class="bl tot"><span>Total</span><span>{{ site.money(b().total, b().currency) }}</span></div>
        <p class="note">{{ payNames[b().payMethod] }} · <b>{{ payStatus[b().payStatus] }}</b>@if (b().payRef) { · {{ b().payRef }} }</p>
        <div class="row mt">
          @if (b().payMethod !== 'card' && b().payStatus === 'unpaid' && b().status !== 'Cancelled') { <button class="btn ghost sm" (click)="markPaid()">Mark as paid</button> }
          @if (['paid', 'refund_due'].includes(b().payStatus) && b().payProvider && isAdmin()) { <button class="btn danger sm" (click)="refund()">Refund {{ site.money(b().total, b().currency) }}</button> }
        </div></div>
    </div></div> }
  </div></div>`,
})
export class BookingDetail implements OnInit {
  private api = inject(Api); private ui = inject(Ui); site = inject(Site);
  ref = input.required<string>(); closed = output<boolean>();
  b = signal<any>(null); drivers = signal<any[]>([]); vehicles = signal<any[]>([]); err = signal(''); busy = signal(false);
  f: any = {}; changed = false;
  statuses = STATUSES; types = TYPE_NAMES; payNames = PAY_NAMES; payStatus = PAY_STATUS;
  isAdmin = computed(() => this.api.user()?.role === 'admin');
  fitVehicles = computed(() => this.vehicles().filter((v) => !this.b() || v.categoryId === this.b().categoryId || v.id === this.b().vehicleId || !v.categoryId));
  digits = (p: string) => String(p || '').replace(/[^0-9]/g, '');
  when = (d: string) => { try { return new Date(d).toLocaleString(this.site.brand().locale || 'en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };

  async ngOnInit() {
    try {
      const [b, d, v] = await Promise.all([this.api.get(`admin/bookings/${this.ref()}`), this.api.get('admin/drivers'), this.api.get('admin/vehicles')]);
      this.drivers.set(d); this.vehicles.set(v); this.setB(b);
    } catch (e: any) { this.err.set(e.message); }
  }
  private setB(b: any) { this.b.set(b); this.f = { status: b.status, driverId: b.driverId, vehicleId: b.vehicleId, note: '' }; }
  private async patch(body: any, msg: string) {
    this.busy.set(true); this.err.set('');
    try { this.setB(await this.api.patch(`admin/bookings/${this.ref()}`, body)); this.changed = true; this.ui.toast(msg); }
    catch (e: any) { this.err.set(e.message); }
    this.busy.set(false);
  }
  save() {
    const b = this.b(), f = this.f, body: any = {};
    if (f.status !== b.status) body.status = f.status;
    if (f.driverId !== b.driverId) body.driverId = f.driverId;
    if (f.vehicleId !== b.vehicleId) body.vehicleId = f.vehicleId;
    if (f.note?.trim()) body.note = f.note.trim();
    if (body.driverId && b.status === 'Confirmed' && !body.status) body.status = 'Assigned';
    if (!Object.keys(body).length) { this.ui.toast('Nothing changed'); return; }
    this.patch(body, 'Booking updated');
  }
  markPaid() { this.patch({ payStatus: 'paid' }, 'Marked as paid'); }
  async refund() {
    if (!(await this.ui.confirm(`Refund ${this.site.money(this.b().total, this.b().currency)} to the customer's card? This sends the money back through the payment provider.`, 'Refund'))) return;
    this.busy.set(true);
    try { this.setB(await this.api.post(`admin/bookings/${this.ref()}/refund`)); this.changed = true; this.ui.toast('Refund sent'); } catch (e: any) { this.err.set(e.message); }
    this.busy.set(false);
  }
}

/* ================= new booking by staff ================= */
@Component({
  selector: 'app-new-booking',
  imports: [FormsModule, Icon],
  template: `<div class="md" (click)="closed.emit(null)"><div class="md-c wide" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
    <div class="md-h"><h3>New booking</h3><button class="x" (click)="closed.emit(null)" aria-label="Close"><app-icon name="x" /></button></div>
    <form class="form" (ngSubmit)="save()" novalidate>
      <label class="fl"><span>Trip type</span><select name="type" [(ngModel)]="t.type" (ngModelChange)="q.set(null)">@for (k of typeKeys; track k) {<option [value]="k">{{ types[k] }}</option>}</select></label>
      <label class="fl"><span>Guests / bags</span><span class="row" style="flex-wrap:nowrap"><input type="number" name="pax" min="1" [(ngModel)]="t.pax" (ngModelChange)="q.set(null)"><input type="number" name="bags" min="0" [(ngModel)]="t.bags" (ngModelChange)="q.set(null)"></span></label>
      <label class="fl"><span>Pickup</span><input name="pickup" list="aplc" [(ngModel)]="t.pickup" (ngModelChange)="q.set(null)"></label>
      @if (t.type !== 'hourly') { <label class="fl"><span>Drop-off</span><input name="dropoff" list="aplc" [(ngModel)]="t.dropoff" (ngModelChange)="q.set(null)"></label> }
      @else { <label class="fl"><span>Hours</span><input type="number" name="hours" min="1" [(ngModel)]="t.hours" (ngModelChange)="q.set(null)"></label> }
      <label class="fl"><span>Date</span><input type="date" name="date" [(ngModel)]="t.date" (ngModelChange)="q.set(null)"></label>
      <label class="fl"><span>Time</span><input type="time" name="time" [(ngModel)]="t.time" (ngModelChange)="q.set(null)"></label>
      @if (t.type === 'round') { <label class="fl"><span>Return date</span><input type="date" name="rd" [(ngModel)]="t.returnDate"></label><label class="fl"><span>Return time</span><input type="time" name="rt" [(ngModel)]="t.returnTime"></label> }
      <datalist id="aplc">@for (p of site.data()?.places || []; track p.id) {<option [value]="p.name"></option>}</datalist>
      @if (!q()) { <div class="wide"><button type="button" class="btn ghost" (click)="quote()" [disabled]="busy()">Get prices</button></div> }
      @else {
        <label class="fl wide"><span>Vehicle and fare ({{ q().km }} km{{ q().kmSource === 'estimate' ? ', estimated' : '' }})</span><select name="cat" [(ngModel)]="c.categoryId">@for (o of q().options; track o.category.id) {<option [value]="o.category.id">{{ o.category.name }} · {{ site.money(o.total) }}</option>}</select></label>
        <label class="fl"><span>Customer name</span><input name="name" [(ngModel)]="c.name"></label>
        <label class="fl"><span>Phone</span><input name="phone" type="tel" [(ngModel)]="c.phone"></label>
        <label class="fl"><span>Email</span><input name="email" type="email" [(ngModel)]="c.email"></label>
        <label class="fl"><span>Payment</span><select name="pay" [(ngModel)]="c.payMethod"><option value="cash">Pay the driver</option><option value="account">Corporate account</option><option value="card">Card (taken by phone or link)</option></select></label>
        <label class="fl"><span>Flight</span><input name="flight" [(ngModel)]="c.flight"></label>
        <label class="fl"><span>Note</span><input name="notes" [(ngModel)]="c.notes"></label>
      }
      @if (err()) { <p class="errmsg wide">{{ err() }}</p> }
      <div class="md-f wide"><button type="button" class="btn ghost" (click)="closed.emit(null)">Cancel</button>@if (q()) {<button class="btn dark" type="submit" [disabled]="busy()">Create booking</button>}</div>
    </form></div></div>`,
})
export class NewBooking {
  private api = inject(Api); site = inject(Site);
  closed = output<string | null>();
  types = TYPE_NAMES; typeKeys = Object.keys(TYPE_NAMES);
  t: any = { type: 'oneway', pickup: '', dropoff: '', date: new Date().toISOString().slice(0, 10), time: '12:00', returnDate: '', returnTime: '', hours: 3, pax: 1, bags: 0 };
  c: any = { categoryId: '', name: '', phone: '', email: '', payMethod: 'cash', flight: '', notes: '' };
  q = signal<any>(null); err = signal(''); busy = signal(false);
  constructor() { this.site.load().catch(() => {}); }
  private trip() { const t = this.t; return { ...t, pax: +t.pax, bags: +t.bags, hours: t.type === 'hourly' ? +t.hours : undefined, dropoff: t.type === 'hourly' ? undefined : t.dropoff, returnDate: t.type === 'round' ? t.returnDate : undefined, returnTime: t.type === 'round' ? t.returnTime : undefined }; }
  async quote() {
    this.busy.set(true); this.err.set('');
    try { const r = await this.api.post('admin/quote', this.trip()); this.q.set(r); this.c.categoryId = r.options[0]?.category.id || ''; if (!r.options.length) this.err.set('No vehicle fits this many guests and bags'); }
    catch (e: any) { this.err.set(e.message); }
    this.busy.set(false);
  }
  async save() {
    this.busy.set(true); this.err.set('');
    try { const b = await this.api.post('admin/bookings', { ...this.trip(), ...this.c }); this.closed.emit(b.ref); }
    catch (e: any) { this.err.set(e.message); }
    this.busy.set(false);
  }
}

/* ================= dashboard ================= */
@Component({
  selector: 'app-dashboard',
  imports: [Head, Badge, RouterLink, BookingDetail, NewBooking],
  template: `<app-head title="Dashboard" [sub]="sub()"><a class="btn ghost sm" routerLink="/" target="_blank">View website</a><button class="btn dark sm" (click)="creating.set(true)">New booking</button></app-head>
  @if (err()) { <p class="err">{{ err() }}</p> }
  @if (s(); as s) {
    <div class="kpis">
      <div class="kpi"><span>Bookings, last 7 days</span><b>{{ s.last7.n }}</b><small [class]="trend(s.last7.n, s.prev7.n)[0]">{{ trend(s.last7.n, s.prev7.n)[1] }}</small></div>
      <div class="kpi"><span>Revenue, last 7 days</span><b>{{ site.money(s.last7.rev) }}</b><small [class]="trend(s.last7.rev, s.prev7.rev)[0]">{{ trend(s.last7.rev, s.prev7.rev)[1] }}</small></div>
      <div class="kpi"><span>Upcoming trips</span><b>{{ s.upcomingCount }}</b><small class="flat">{{ s.unassigned }} still need a driver</small></div>
      <div class="kpi"><span>Cancellation rate, 30 days</span><b>{{ s.cancelRate30.toFixed(1) }}%</b><small class="flat">{{ s.cancelled30 }} of {{ s.total30 }} bookings</small></div>
    </div>
    @if (s.pending || s.refundsDue) { <p class="okbox" style="background:var(--warnb);color:var(--warn)">@if (s.pending) { <span>{{ s.pending }} booking{{ s.pending > 1 ? 's' : '' }} waiting for confirmation. </span> }@if (s.refundsDue) { <span>{{ s.refundsDue }} refund{{ s.refundsDue > 1 ? 's' : '' }} due. </span> } <a routerLink="/admin/dispatch">Open dispatch</a></p> }
    <div class="two"><div class="card"><h2>Revenue by trip day, last 14 days</h2>
      <div class="bars">@for (x of s.series; track x.date) { <div [class.today]="x.date === s.today" [title]="x.date + ': ' + x.n + ' trips, ' + site.money(x.rev)"><i [style.height.%]="max(2, x.rev / maxRev() * 100)"><b>{{ x.n }}</b></i><span>{{ +x.date.slice(8) }}</span></div> }</div>
      <p class="note">Bar height is revenue; the number on each bar is trips. Today is dark.</p></div>
      <div class="card"><h2>Vehicle mix, 30 days</h2><div class="hb">@for (m of s.mix; track m.name) { <div><span>{{ m.name }}</span><span>{{ m.n }}</span><i><i [style.width.%]="m.n / maxMix() * 100"></i></i></div> } @empty { <div class="empty">No trips yet.</div> }</div></div></div>
    <div class="two"><div class="card"><h2><span>Next trips</span><a class="lnk" routerLink="/admin/bookings">All bookings</a></h2>
      @if (s.next.length) { <table class="tbl stack"><thead><tr><th>When</th><th>Trip</th><th>Customer</th><th>Status</th></tr></thead><tbody>
        @for (b of s.next; track b.ref) { <tr class="click" (click)="open.set(b.ref)"><td data-l="When" style="white-space:nowrap">{{ site.date(b.date, b.time) }}<small>{{ b.ref }}</small></td><td data-l="Trip">{{ b.pickup }}<small>{{ b.dropoff ? '→ ' + b.dropoff : b.hours + ' hours' }}</small></td><td data-l="Customer">{{ b.name }}<small>{{ b.categoryName }}</small></td><td data-l="Status"><app-badge [value]="b.status" /></td></tr> }
      </tbody></table> } @else { <div class="empty">No upcoming trips.</div> }</div>
      <div class="card"><h2>Fleet today</h2><div class="hb">
        <div><span>Drivers available</span><span>{{ s.driversAvail }} of {{ s.drivers }}</span><i><i [style.width.%]="s.drivers ? s.driversAvail / s.drivers * 100 : 0"></i></i></div>
        <div><span>Vehicles available</span><span>{{ s.vehiclesAvail }} of {{ s.vehicles }}</span><i><i [style.width.%]="s.vehicles ? s.vehiclesAvail / s.vehicles * 100 : 0"></i></i></div>
        <div><span>Upcoming trips needing a driver</span><span>{{ s.unassigned }} of {{ s.upcomingCount }}</span><i><i [style.width.%]="s.upcomingCount ? s.unassigned / s.upcomingCount * 100 : 0"></i></i></div></div></div></div>
  } @else if (!err()) { <div class="loading"><span class="spin"></span></div> }
  @if (open()) { <app-booking-detail [ref]="open()!" (closed)="detailClosed($event)" /> }
  @if (creating()) { <app-new-booking (closed)="created($event)" /> }`,
})
export class Dashboard implements OnInit {
  private api = inject(Api); site = inject(Site);
  s = signal<any>(null); err = signal(''); open = signal<string | null>(null); creating = signal(false);
  max = Math.max;
  maxRev = computed(() => Math.max(1, ...(this.s()?.series || []).map((x: any) => x.rev)));
  maxMix = computed(() => Math.max(1, ...(this.s()?.mix || []).map((x: any) => x.n)));
  sub = computed(() => { try { return new Date().toLocaleDateString(this.site.brand().locale || 'en', { weekday: 'long', day: 'numeric', month: 'long' }) + (this.site.brand().city ? ' · ' + this.site.brand().city : ''); } catch { return ''; } });
  ngOnInit() { this.load(); }
  detailClosed(changed: boolean) { this.open.set(null); if (changed) this.load(); }
  created(ref: string | null) { this.creating.set(false); if (ref) { this.open.set(ref); this.load(); } }
  async load() { try { this.s.set(await this.api.get('admin/dashboard')); } catch (e: any) { this.err.set(e.message); } }
  trend(c: number, p: number): [string, string] {
    if (!p) return ['flat', c ? 'New this week' : 'No trips yet'];
    const ch = ((c - p) / p) * 100;
    return [ch > 0.5 ? 'up' : ch < -0.5 ? 'down' : 'flat', `${ch > 0.5 ? '▲' : ch < -0.5 ? '▼' : '■'} ${Math.abs(ch).toFixed(0)}% vs previous 7 days`];
  }
}

/* ================= bookings list ================= */
@Component({
  selector: 'app-bookings',
  imports: [FormsModule, Head, Badge, BookingDetail, NewBooking, Icon],
  template: `<app-head title="Bookings" [sub]="total() + ' matching bookings'"><button class="btn ghost sm" (click)="exportCsv()"><app-icon name="download" />Export CSV</button><button class="btn dark sm" (click)="creating.set(true)">New booking</button></app-head>
  <div class="card"><div class="filt">
    <input type="search" placeholder="Search reference, customer, phone or place" [(ngModel)]="f.q" (ngModelChange)="debounce()" aria-label="Search">
    <select [(ngModel)]="f.when" (ngModelChange)="load()" aria-label="When"><option value="upcoming">Upcoming</option><option value="today">Today</option><option value="past">Past</option><option value="all">All dates</option></select>
    <select [(ngModel)]="f.status" (ngModelChange)="load()" aria-label="Status"><option value="">All statuses</option>@for (s of statuses; track s) {<option>{{ s }}</option>}</select></div>
    @if (err()) { <p class="err">{{ err() }}</p> }
    @if (rows().length) { <div style="overflow-x:auto"><table class="tbl stack"><thead><tr><th>Reference</th><th>Trip</th><th>When</th><th>Customer</th><th>Vehicle</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
      @for (b of rows(); track b.ref) { <tr class="click" (click)="open.set(b.ref)">
        <td data-l="Reference"><b>{{ b.ref }}</b><small>{{ types[b.type] }}</small></td><td data-l="Trip">{{ b.pickup }}<small>{{ b.dropoff ? '→ ' + b.dropoff : b.hours + ' hours' }}</small></td>
        <td data-l="When" style="white-space:nowrap">{{ site.date(b.date, b.time) }}</td><td data-l="Customer">{{ b.name }}<small>{{ b.phone }}</small></td>
        <td data-l="Vehicle">{{ b.categoryName }}<small>{{ b.driverId ? driverName(b.driverId) : 'No driver' }}</small></td><td data-l="Total" class="num">{{ site.money(b.total, b.currency) }}<small>{{ pay[b.payStatus] }}</small></td><td data-l="Status"><app-badge [value]="b.status" /></td></tr> }
    </tbody></table></div>
    @if (rows().length < total()) { <div class="row mt"><button class="btn ghost sm" (click)="more()">Show more</button></div> } }
    @else if (!loading()) { <div class="empty">No bookings match.</div> } @else { <div class="loading"><span class="spin"></span></div> }
  </div>
  @if (open()) { <app-booking-detail [ref]="open()!" (closed)="detailClosed($event)" /> }
  @if (creating()) { <app-new-booking (closed)="created($event)" /> }`,
})
export class Bookings implements OnInit {
  private api = inject(Api); site = inject(Site); private ui = inject(Ui);
  statuses = STATUSES; types = TYPE_NAMES; pay = PAY_STATUS;
  f = { q: '', when: 'upcoming', status: '' };
  rows = signal<any[]>([]); total = signal(0); loading = signal(false); err = signal(''); open = signal<string | null>(null); creating = signal(false);
  drivers = signal<any[]>([]);
  private t: any;
  driverName = (id: string) => this.drivers().find((d) => d.id === id)?.name || 'Driver';
  async ngOnInit() { this.load(); try { this.drivers.set(await this.api.get('admin/drivers')); } catch { /* optional */ } }
  detailClosed(changed: boolean) { this.open.set(null); if (changed) this.load(); }
  created(ref: string | null) { this.creating.set(false); if (ref) { this.open.set(ref); this.load(); } }

  qs(offset = 0) { const p = new URLSearchParams({ ...this.f, limit: '100', offset: String(offset) }); return p.toString(); }
  debounce() { clearTimeout(this.t); this.t = setTimeout(() => this.load(), 300); }
  async load() {
    this.loading.set(true);
    try { const r = await this.api.get(`admin/bookings?${this.qs()}`); this.rows.set(r.items); this.total.set(r.total); this.err.set(''); } catch (e: any) { this.err.set(e.message); }
    this.loading.set(false);
  }
  async more() { const r = await this.api.get(`admin/bookings?${this.qs(this.rows().length)}`); this.rows.update((x) => [...x, ...r.items]); }
  async exportCsv() {
    try {
      const csv = await this.api.text(`admin/bookings.csv?${this.qs()}`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e: any) { this.ui.toast(e.message); }
  }
}

/* ================= dispatch board ================= */
@Component({
  selector: 'app-dispatch',
  imports: [Head, BookingDetail, Icon],
  template: `<app-head title="Dispatch" sub="Move trips through the day. Click a card for details."><button class="btn ghost sm" (click)="load()">Refresh</button></app-head>
  @if (err()) { <p class="err">{{ err() }}</p> }
  <div class="kan">@for (c of cols; track c) { <div class="col"><h3><span>{{ c }}</span><span>{{ by(c).length }}</span></h3>
    @for (b of by(c); track b.ref) { <div class="tk" (click)="open.set(b.ref)"><span class="t">{{ site.date(b.date, b.time) }}</span><span>{{ b.pickup }}{{ b.dropoff ? ' → ' + b.dropoff : ' · ' + b.hours + ' h' }}</span>
      <small>{{ b.categoryName }} · {{ b.name }} · {{ b.ref }}</small>@if (b.driverId) {<small><app-icon name="id" /> {{ driverName(b.driverId) }}</small>}
      <button class="btn sm" [class.p]="c === 'Confirmed'" [class.ghost]="c !== 'Confirmed'" (click)="$event.stopPropagation(); advance(b)">{{ next[c] }}</button></div> } @empty { <div class="empty">Clear</div> }
  </div> }</div>
  @if (open()) { <app-booking-detail [ref]="open()!" (closed)="detailClosed($event)" /> }`,
})
export class Dispatch implements OnInit {
  private api = inject(Api); site = inject(Site); private ui = inject(Ui);
  cols = ['Pending', 'Confirmed', 'Assigned', 'On trip'];
  next: Record<string, string> = { Pending: 'Confirm', Confirmed: 'Assign driver', Assigned: 'Start trip', 'On trip': 'Complete' };
  rows = signal<any[]>([]); drivers = signal<any[]>([]); err = signal(''); open = signal<string | null>(null);
  by = (s: string) => this.rows().filter((b) => b.status === s);
  driverName = (id: string) => this.drivers().find((d) => d.id === id)?.name || '';
  ngOnInit() { this.load(); }
  detailClosed(changed: boolean) { this.open.set(null); if (changed) this.load(); }
  async load() {
    try {
      const [a, d] = await Promise.all([this.api.get('admin/bookings?when=all&limit=500&status='), this.api.get('admin/drivers')]);
      this.rows.set(a.items.filter((b: any) => this.cols.includes(b.status))); this.drivers.set(d); this.err.set('');
    } catch (e: any) { this.err.set(e.message); }
  }
  async advance(b: any) {
    if (b.status === 'Confirmed') { this.open.set(b.ref); this.ui.toast('Choose a driver, then save'); return; }
    const n = ({ Pending: 'Confirmed', Assigned: 'On trip', 'On trip': 'Completed' } as any)[b.status];
    try { await this.api.patch(`admin/bookings/${b.ref}`, { status: n }); this.ui.toast(`${b.ref} is now ${n}`); this.load(); } catch (e: any) { this.ui.toast(e.message); }
  }
}

/* ================= enquiries ================= */
@Component({
  selector: 'app-enquiries',
  imports: [Head, Badge],
  template: `<app-head title="Enquiries" sub="Messages from the contact form on your website" />
  <div class="card">@if (rows().length) { <table class="tbl stack"><thead><tr><th>Received</th><th>From</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>
    @for (e of rows(); track e.id) { <tr><td data-l="Received" style="white-space:nowrap">{{ when(e.createdAt) }}</td><td data-l="From">{{ e.name }}<small><a [href]="'mailto:' + e.email">{{ e.email }}</a>{{ e.phone ? ' · ' + e.phone : '' }}</small></td>
      <td data-l="Message" style="max-width:460px;white-space:pre-wrap">{{ e.message }}</td><td data-l="Status"><app-badge [value]="e.status" /></td>
      <td class="acts"><button class="lnk" (click)="toggle(e)">{{ e.status === 'New' ? 'Mark handled' : 'Reopen' }}</button>@if (admin()) {<button class="lnk del" (click)="remove(e)">Delete</button>}</td></tr> }
  </tbody></table> } @else { <div class="empty">No enquiries yet.</div> }</div>`,
})
export class Enquiries implements OnInit {
  private api = inject(Api); private ui = inject(Ui); site = inject(Site);
  rows = signal<any[]>([]);
  admin = computed(() => this.api.user()?.role === 'admin');
  when = (d: string) => new Date(d).toLocaleString(this.site.brand().locale || 'en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  ngOnInit() { this.load(); }
  async load() { try { this.rows.set(await this.api.get('admin/enquiries')); } catch (e: any) { this.ui.toast(e.message); } }
  async toggle(e: any) { await this.api.patch(`admin/enquiries/${e.id}`, { status: e.status === 'New' ? 'Handled' : 'New' }); this.load(); }
  async remove(e: any) { if (await this.ui.confirm('Delete this enquiry?', 'Delete')) { await this.api.del(`admin/enquiries/${e.id}`); this.load(); } }
}
