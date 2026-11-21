import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Site, TYPE_NAMES } from '../core/site';
import { Badge, Car, Icon } from '../core/ui';

declare const Razorpay: any;

@Component({
  selector: 'app-book',
  imports: [FormsModule, RouterLink, Icon, Car, Badge],
  template: `
  <section class="sec" style="padding-top:28px"><div class="wrap" style="max-width:1000px">
    @if (!trip()) { <p class="err">Trip details are missing. <a routerLink="/" fragment="book">Start a new booking</a></p> }
    @else {
    <div class="steps-nav"><a routerLink="/" fragment="book">← Change trip</a><span>·</span>
      <span>@if (step() === 'veh') {<b>1. Vehicle</b>} @else {1. Vehicle}</span><span>→</span>
      <span>@if (step() === 'det') {<b>2. Your details</b>} @else {2. Your details}</span><span>→</span>
      <span>@if (step() === 'done') {<b>3. Confirmed</b>} @else {3. Confirmed}</span></div>
    <div class="trip"><span><b>{{ typeName[trip().type] }}</b></span><span>{{ trip().pickup }}@if (trip().dropoff) { → {{ trip().dropoff }} }</span>
      <span>{{ site.date(trip().date, trip().time) }}</span>
      @if (trip().type === 'round') { <span>Return {{ site.date(trip().returnDate, trip().returnTime) }}</span> }
      @if (trip().type === 'hourly') { <span>{{ trip().hours }} hours</span> } @else if (q()) { <span>{{ q().km }} km{{ q().kmSource === 'estimate' ? ' (estimate)' : '' }}</span> }
      <span>{{ trip().pax }} guest{{ trip().pax > 1 ? 's' : '' }} · {{ trip().bags }} bag{{ trip().bags === 1 ? '' : 's' }}</span></div>

    @if (err()) { <p class="err" role="alert">{{ err() }}</p> }
    @if (busy() && !q()) { <div class="loading"><span class="spin"></span> Finding prices…</div> }

    @if (q(); as quote) {
      @if (step() === 'veh') {
        @if (quote.kmSource === 'estimate') {
          <div class="kmrow"><div style="flex:1;min-width:200px">We couldn't map one of these addresses, so the distance is an estimate. Adjust it if you know it; our team confirms the final fare.</div>
          <label class="fld"><span>Distance, km</span><input type="number" min="1" max="2000" [ngModel]="kmHint()" (ngModelChange)="kmHint.set(+$event)" (change)="requote()"></label></div>
        }
        @if (quote.options.length) {
          <div class="vlist">@for (o of quote.options; track o.category.id) {
            <button type="button" class="vopt" (click)="choose(o.category.id)" [attr.aria-pressed]="catId() === o.category.id">
              <app-car [type]="o.category.type" /><div><h3>{{ o.category.name }}</h3><p>{{ o.category.description }}</p>
              <div class="specs"><span><app-icon name="user" />{{ o.category.seats }}</span><span><app-icon name="bag" />{{ o.category.bags }}</span></div></div>
              <div class="pr">{{ site.money(o.total) }}<small>total{{ site.data()?.pricing?.tax ? ', incl. ' + site.data()?.pricing?.taxLabel : '' }}</small></div>
            </button> }</div>
        } @else { <div class="empty">No vehicle fits {{ trip().pax }} guests and {{ trip().bags }} bags. Reduce bags or guests, or <a routerLink="/" fragment="contact">ask us for a group quote</a>.</div> }
        <div class="sheet-f" style="padding:16px 0;border:0"><span class="tot">@if (opt()) { Selected: {{ opt().category.name }}<b>{{ site.money(opt().total) }}</b> } @else { Select a vehicle to continue }</span>
          <button class="btn dark" [disabled]="!opt()" (click)="step.set('det'); top()">Continue</button></div>
      }

      @if (step() === 'det' && opt(); as o) {
        <div class="det"><form class="form" (ngSubmit)="confirm()" novalidate>
          <label class="fl"><span>Full name</span><input name="name" [(ngModel)]="c.name" autocomplete="name"></label>
          <label class="fl"><span>Mobile number</span><input name="phone" type="tel" [(ngModel)]="c.phone" autocomplete="tel" placeholder="+ country code"></label>
          <label class="fl wide"><span>Email for confirmation</span><input name="email" type="email" [(ngModel)]="c.email" autocomplete="email"></label>
          @if (quote.airport) { <label class="fl"><span>Flight number</span><input name="flight" [(ngModel)]="c.flight" placeholder="e.g. EK 203"></label> }
          <label class="fl" [class.wide]="!quote.airport"><span>Note for the driver</span><input name="notes" [(ngModel)]="c.notes" placeholder="Gate, building, landmark"></label>
          @if (site.data()?.extras?.length) {
            <div class="wide"><p class="h4">Extras</p>@for (x of site.data()!.extras; track x.id) {
              <div class="ex"><div><b>{{ x.name }}</b><small>{{ site.money(x.price) }} each</small></div>
              <div class="qty"><button type="button" (click)="extra(x.id, -1)" aria-label="Fewer">−</button><output>{{ extras()[x.id] || 0 }}</output><button type="button" (click)="extra(x.id, 1)" aria-label="More">+</button></div></div> }</div>
          }
          <div class="wide"><p class="h4">Payment</p><div class="pays">
            @if (site.data()?.payments?.card) { <label class="pay"><input type="radio" name="pay" value="card" [(ngModel)]="c.payMethod"><span><b>Pay now by card</b><small>Secure checkout. Your booking is confirmed straight away.</small></span></label> }
            @if (site.data()?.payments?.cash) { <label class="pay"><input type="radio" name="pay" value="cash" [(ngModel)]="c.payMethod"><span><b>Pay the driver</b><small>Cash or card at the end of the trip.</small></span></label> }
            @if (site.data()?.payments?.account) { <label class="pay"><input type="radio" name="pay" value="account" [(ngModel)]="c.payMethod"><span><b>Corporate account</b><small>Billed to your company. Approved accounts only.</small></span></label> }
          </div></div>
          <p class="note wide">By booking you agree to our <a routerLink="/terms" target="_blank">terms</a>.</p>
          <div class="wide row"><button type="button" class="btn ghost" (click)="step.set('veh')">Back</button>
            <button class="btn p" type="submit" [disabled]="busy()">{{ busy() ? 'Please wait…' : c.payMethod === 'card' ? 'Pay ' + site.money(o.total) : 'Confirm booking' }}</button></div>
        </form>
        <aside class="sum"><h3>Fare breakdown</h3>
          @for (l of o.lines; track $index) { <div class="bl"><span>{{ l[0] }}</span><span>{{ site.money(l[1]) }}</span></div> }
          <div class="bl tot"><span>Total</span><span>{{ site.money(o.total) }}</span></div>
          <div class="promo"><input [(ngModel)]="promoInput" name="promo" placeholder="Promo code" aria-label="Promo code"><button class="btn ghost sm" type="button" (click)="applyPromo()">Apply</button></div>
          @if (o.promoOk) { <p class="okmsg">Code {{ o.promoOk }} applied.</p> } @else if (o.promoOk === false) { <p class="errmsg">That code is not valid.</p> }
          <p class="note">Fixed fare. You can cancel online up to {{ site.data()?.pricing?.cancelHours }} hours before pickup.</p></aside></div>
      }
    }

    @if (step() === 'done' && done(); as b) {
      <div class="done"><div class="big"><app-icon name="check" /></div>
        <h2>Thank you, {{ b.name.split(' ')[0] }}.</h2><p class="note">Your booking reference</p><p class="ref">{{ b.ref }}</p>
        <p class="note">We've sent the details to {{ b.email }}. Keep this reference to manage your booking.</p>
        <dl class="kv"><dt>Status</dt><dd><app-badge [value]="b.status" /></dd><dt>Vehicle</dt><dd>{{ b.categoryName }}</dd><dt>Total</dt><dd>{{ site.money(b.total, b.currency) }}</dd>
          <dt>Payment</dt><dd>{{ b.payStatus === 'paid' ? 'Paid by card' : b.payMethod === 'cash' ? 'Pay the driver' : b.payMethod === 'account' ? 'Corporate account' : 'Awaiting payment' }}</dd></dl>
        <div class="row" style="justify-content:center"><a class="btn ghost" routerLink="/">Home</a><a class="btn dark" routerLink="/manage" [queryParams]="{ ref: b.ref, email: b.email }">Manage booking</a></div></div>
    }
    }
  </div></section>`,
})
export class Book {
  site = inject(Site);
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  typeName = TYPE_NAMES;
  trip = signal<any>(null);
  q = signal<any>(null);
  step = signal<'veh' | 'det' | 'done'>('veh');
  catId = signal<string>('');
  extras = signal<Record<string, number>>({});
  promo = signal('');
  promoInput = '';
  kmHint = signal(15);
  err = signal('');
  busy = signal(false);
  done = signal<any>(null);
  c = { name: '', phone: '', email: '', flight: '', notes: '', payMethod: 'card' };
  private pendingPay: { b: any; p: any } | null = null;
  opt = computed(() => this.q()?.options.find((o: any) => o.category.id === this.catId()) || null);

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    if (!p.get('pickup')) return;
    this.trip.set({ type: p.get('type') || 'oneway', pickup: p.get('pickup'), dropoff: p.get('dropoff') || '', date: p.get('date'), time: p.get('time'), returnDate: p.get('returnDate') || '', returnTime: p.get('returnTime') || '', hours: +(p.get('hours') || 0), pax: +(p.get('pax') || 1), bags: +(p.get('bags') || 0) });
    this.site.load().then((d) => { if (!d.payments.card) this.c.payMethod = d.payments.cash ? 'cash' : 'account'; }).catch(() => {});
    this.requote();
  }

  private body() {
    const t = this.trip();
    return { ...t, dropoff: t.type === 'hourly' ? undefined : t.dropoff, hours: t.type === 'hourly' ? t.hours : undefined, returnDate: t.type === 'round' ? t.returnDate : undefined, returnTime: t.type === 'round' ? t.returnTime : undefined, extras: this.extras(), promo: this.promo() || undefined, kmHint: this.kmHint() };
  }

  async requote() {
    this.busy.set(true); this.err.set('');
    try { const r = await this.api.post('public/quote', this.body()); this.q.set(r); if (r.kmSource === 'estimate') this.kmHint.set(r.km); }
    catch (e: any) { this.err.set(e.message); }
    this.busy.set(false);
  }
  choose(id: string) { this.catId.set(id); }
  extra(id: string, d: number) { this.extras.update((x) => ({ ...x, [id]: Math.max(0, Math.min(5, (x[id] || 0) + d)) })); this.requote(); }
  applyPromo() { this.promo.set(this.promoInput.trim().toUpperCase()); this.requote(); }
  top() { window.scrollTo({ top: 0 }); }

  async confirm() {
    const c = this.c; let e = '';
    if (c.name.trim().length < 2) e = 'Please enter your full name.';
    else if (!/^\+?[\d\s()./-]{7,}$/.test(c.phone.trim())) e = 'Please enter a valid mobile number with country code.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim())) e = 'Please enter a valid email address.';
    if (e) { this.err.set(e); this.top(); return; }
    if (this.opt()?.promoOk === false) this.promo.set('');
    this.busy.set(true); this.err.set('');
    if (this.pendingPay && c.payMethod === 'card') { await this.razorpay(this.pendingPay.b, this.pendingPay.p); return; }
    try {
      const r = await this.api.post('public/bookings', { ...this.body(), categoryId: this.catId(), ...c });
      if (r.payment?.provider === 'stripe') { location.href = r.payment.url; return; }
      if (r.payment?.provider === 'razorpay') { this.pendingPay = { b: r.booking, p: r.payment }; await this.razorpay(r.booking, r.payment); return; }
      this.finish(r.booking);
    } catch (x: any) { this.err.set(x.message); this.top(); }
    this.busy.set(false);
  }

  private finish(b: any) { this.done.set(b); this.step.set('done'); this.busy.set(false); this.top(); }

  private loadScript(src: string) {
    return new Promise<void>((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load the payment window. Check your connection.'));
      document.head.appendChild(s);
    });
  }

  private async razorpay(b: any, p: any) {
    await this.loadScript('https://checkout.razorpay.com/v1/checkout.js');
    const brand = this.site.brand();
    const rz = new Razorpay({
      key: p.keyId, amount: p.amount, currency: p.currency, order_id: p.orderId, name: brand.name, description: `Booking ${b.ref}`,
      prefill: { name: b.name, email: b.email, contact: b.phone }, theme: { color: brand.primary },
      handler: async (resp: any) => {
        try { this.finish(await this.api.post('public/payments/razorpay', { ref: b.ref, orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature })); }
        catch (e: any) { this.err.set(e.message + ` (reference ${b.ref})`); this.busy.set(false); }
      },
      modal: { ondismiss: () => { this.busy.set(false); this.err.set(`Payment was not completed. Your booking ${b.ref} is on hold; try again or choose to pay the driver.`); } },
    });
    rz.open();
  }
}
