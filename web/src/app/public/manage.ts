import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { PAY_STATUS, Site, TYPE_NAMES } from '../core/site';
import { Badge, Icon, Ui } from '../core/ui';

@Component({
  selector: 'app-booking-view',
  imports: [Badge],
  template: `@if (b(); as b) {
    @if (b.status !== 'Cancelled') { <div class="tl">@for (s of steps; track s; let i = $index) { <div [class.on]="i <= steps.indexOf(b.status)">{{ s }}</div> }</div> }
    <dl class="kv"><dt>Reference</dt><dd>{{ b.ref }}</dd><dt>Status</dt><dd><app-badge [value]="b.status" /></dd><dt>Trip</dt><dd>{{ types[b.type] }}</dd>
      <dt>From</dt><dd>{{ b.pickup }}</dd>@if (b.dropoff) {<dt>To</dt><dd>{{ b.dropoff }}</dd>}
      <dt>When</dt><dd>{{ site.date(b.date, b.time) }}@if (b.returnDate) { · return {{ site.date(b.returnDate, b.returnTime) }} }@if (b.hours) { · {{ b.hours }} hours }</dd>
      <dt>Vehicle</dt><dd>{{ b.categoryName }}@if (b.vehicle) { · {{ b.vehicle.color }} {{ b.vehicle.model }}, {{ b.vehicle.plate }} }</dd>
      @if (b.driver) { <dt>Driver</dt><dd>{{ b.driver.name }} · <a [href]="'tel:' + b.driver.phone">{{ b.driver.phone }}</a></dd> }
      <dt>Guests</dt><dd>{{ b.pax }} · {{ b.bags }} bags</dd><dt>Total</dt><dd>{{ site.money(b.total, b.currency) }}</dd><dt>Payment</dt><dd>{{ pay[b.payStatus] }}</dd></dl>
  }`,
})
export class BookingView {
  site = inject(Site);
  b = input<any>(null);
  steps = ['Pending', 'Confirmed', 'Assigned', 'On trip', 'Completed'];
  types = TYPE_NAMES; pay = PAY_STATUS;
}

@Component({
  selector: 'app-manage',
  imports: [FormsModule, BookingView, RouterLink],
  template: `<section class="sec" style="padding-top:36px"><div class="wrap narrow">
    <h1 style="font-size:34px;font-weight:800;margin-bottom:6px">Manage booking</h1><p class="muted" style="margin-bottom:18px">Find your trip with the reference and email you booked with.</p>
    <form class="form" (ngSubmit)="find()" novalidate>
      <label class="fl"><span>Booking reference</span><input name="ref" [(ngModel)]="ref" placeholder="AB-XXXXXX" style="text-transform:uppercase"></label>
      <label class="fl"><span>Email</span><input name="email" type="email" [(ngModel)]="email" autocomplete="email"></label>
      <button class="btn dark wide" type="submit" [disabled]="busy()">{{ busy() ? 'Searching…' : 'Find booking' }}</button></form>
    @if (err()) { <p class="err" role="alert">{{ err() }}</p> }
    @if (b()) {
      <app-booking-view [b]="b()" />
      @if (b().canCancel) { <button class="btn danger" (click)="cancel()" [disabled]="busy()">Cancel this booking</button> }
      @else if (['Pending','Confirmed','Assigned'].includes(b().status)) { <p class="note">Online cancellation has closed for this trip. Please <a routerLink="/" fragment="contact">contact us</a>.</p> }
    }
  </div></section>`,
})
export class Manage {
  private api = inject(Api); private ui = inject(Ui);
  ref = ''; email = '';
  b = signal<any>(null); err = signal(''); busy = signal(false);
  constructor() {
    inject(Site).load().catch(() => {});
    const p = inject(ActivatedRoute).snapshot.queryParamMap;
    this.ref = p.get('ref') || ''; this.email = p.get('email') || '';
    if (this.ref && this.email) this.find();
  }
  async find() {
    if (!this.ref.trim() || !this.email.trim()) { this.err.set('Enter your booking reference and email.'); return; }
    this.busy.set(true); this.err.set(''); this.b.set(null);
    try { this.b.set(await this.api.post('public/bookings/find', { ref: this.ref.trim().toUpperCase(), email: this.email.trim() })); }
    catch (e: any) { this.err.set(e.message); }
    this.busy.set(false);
  }
  async cancel() {
    if (!(await this.ui.confirm('Your booking will be cancelled. Card payments are refunded to the original card.', 'Cancel booking'))) return;
    this.busy.set(true);
    try { this.b.set(await this.api.post('public/bookings/cancel', { ref: this.b().ref, email: this.b().email })); this.ui.toast('Booking cancelled'); }
    catch (e: any) { this.err.set(e.message); }
    this.busy.set(false);
  }
}

@Component({
  selector: 'app-paid',
  imports: [RouterLink, Icon],
  template: `<section class="sec"><div class="wrap narrow"><div class="done">
    @if (state() === 'wait') { <div class="loading"><span class="spin"></span> Confirming your payment…</div> }
    @if (state() === 'ok') { <div class="big"><app-icon name="check" /></div><h2>Payment received</h2><p class="note">Your booking reference</p><p class="ref">{{ b()?.ref }}</p>
      <p class="note">We've emailed the details to {{ b()?.email }}.</p><div class="row mt" style="justify-content:center"><a class="btn dark" routerLink="/manage" [queryParams]="{ ref: b()?.ref, email: b()?.email }">Manage booking</a></div> }
    @if (state() === 'fail') { <h2>Payment not completed</h2><p class="err">{{ err() }}</p><p class="note">Booking {{ ref }} is on hold. Start again or contact us quoting this reference.</p><a class="btn dark mt" routerLink="/" fragment="book">Book again</a> }
  </div></div></section>`,
})
export class Paid {
  private api = inject(Api);
  state = signal<'wait' | 'ok' | 'fail'>('wait'); b = signal<any>(null); err = signal(''); ref = '';
  constructor() {
    const p = inject(ActivatedRoute).snapshot.queryParamMap;
    this.ref = p.get('ref') || '';
    if (p.get('cancelled')) { this.err.set('You left the payment page before paying.'); this.state.set('fail'); return; }
    this.api.post('public/payments/stripe', { ref: this.ref, sessionId: p.get('session_id') })
      .then((b) => { this.b.set(b); this.state.set('ok'); })
      .catch((e) => { this.err.set(e.message); this.state.set('fail'); });
  }
}
