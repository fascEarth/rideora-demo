import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../core/api';
import { Site } from '../core/site';
import { Car, Icon } from '../core/ui';

interface TripForm { type: string; pickup: string; dropoff: string; date: string; time: string; returnDate: string; returnTime: string; hours: number; pax: number; bags: number }

@Component({
  selector: 'app-home',
  imports: [FormsModule, Icon, Car],
  template: `
  @if (site.data(); as d) {
  <section class="hero" id="top"><div class="wrap">
    <div class="hero-copy"><h1>{{ d.content.heroTitle }}</h1>
      <div><p class="lead">{{ d.content.heroSub }}</p>
        <div class="ticks">@for (f of d.content.features.slice(0, 3); track $index) { <span><app-icon name="check" />{{ f.t }}</span> }</div></div></div>

    <form class="bk" id="book" (ngSubmit)="go()" novalidate>
      <div class="tabs" role="group" aria-label="Trip type">
        @for (t of tripTypes; track t[0]) {
          <button type="button" [attr.aria-pressed]="f().type === t[0]" (click)="setType(t[0])"><app-icon [name]="t[2]" />{{ t[1] }}</button>
        }
      </div>
      <div class="bk-grid" [class.hourly]="f().type === 'hourly'">
        <label class="fld f-pick"><span>Pickup</span><input name="pickup" [ngModel]="f().pickup" (ngModelChange)="set('pickup', $event)" list="plc" placeholder="Airport, hotel or address" autocomplete="off"></label>
        <button type="button" class="swap" (click)="swap()" aria-label="Swap pickup and drop-off"><app-icon name="swap" /></button>
        <label class="fld f-drop"><span>Drop-off</span><input name="dropoff" [ngModel]="f().dropoff" (ngModelChange)="set('dropoff', $event)" list="plc" placeholder="Where to?" autocomplete="off"></label>
        <label class="fld f-hours"><span>Hours</span><select name="hours" [ngModel]="f().hours" (ngModelChange)="set('hours', +$event)">@for (h of hoursList(); track h) { <option [ngValue]="h">{{ h }}</option> }</select></label>
        <label class="fld f-date"><span>Date</span><input type="date" name="date" [min]="site.today()" [ngModel]="f().date" (ngModelChange)="set('date', $event)"></label>
        <label class="fld f-time"><span>Time</span><input type="time" name="time" [ngModel]="f().time" (ngModelChange)="set('time', $event)"></label>
        <label class="fld f-pax"><span>Guests</span><select name="pax" [ngModel]="f().pax" (ngModelChange)="set('pax', +$event)">@for (n of paxList(); track n) { <option [ngValue]="n">{{ n }}</option> }</select></label>
        <label class="fld f-bags"><span>Bags</span><select name="bags" [ngModel]="f().bags" (ngModelChange)="set('bags', +$event)">@for (n of bagList(); track n) { <option [ngValue]="n">{{ n }}</option> }</select></label>
        <button class="btn dark bk-go" type="submit">See prices</button>
      </div>
      @if (f().type === 'round') {
        <div class="bk-ret"><label class="fld"><span>Return date</span><input type="date" name="returnDate" [min]="f().date" [ngModel]="f().returnDate" (ngModelChange)="set('returnDate', $event)"></label>
        <label class="fld"><span>Return time</span><input type="time" name="returnTime" [ngModel]="f().returnTime" (ngModelChange)="set('returnTime', $event)"></label></div>
      }
      @if (err()) { <p class="bk-err" role="alert">{{ err() }}</p> }
      <datalist id="plc">@for (p of d.places; track p.id) { <option [value]="p.name"></option> }</datalist>
    </form></div>
    <svg class="scene" viewBox="0 0 1260 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g fill="#000" opacity=".07">@for (b of back; track $index) { <rect [attr.x]="b[0]" [attr.y]="190 - b[2]" [attr.width]="b[1]" [attr.height]="b[2]" rx="3" /> }</g>
      <g fill="#000" opacity=".09">@for (b of front; track $index) { <rect [attr.x]="b[0]" [attr.y]="190 - b[2]" [attr.width]="b[1]" [attr.height]="b[2]" rx="3" /> }</g>
      <rect y="188" width="1260" height="6" fill="#fff" opacity=".55" /><rect y="194" width="1260" height="66" fill="#1E2025" />
      <line class="lane" x1="0" y1="227" x2="1260" y2="227" stroke="#fff" stroke-opacity=".55" stroke-width="4" />
    </svg>
    <div class="scene-cars" aria-hidden="true"><app-car type="van" color="#F4F5F7" class="c1" /><app-car type="lux" color="#16181C" class="c2" /><app-car type="suv" color="#FFFFFF" class="c3" /></div>
  </section>

  <section class="sec"><div class="wrap grid4">
    @for (x of d.content.features; track $index) { <div class="feat"><span class="bubble"><app-icon [name]="x.icon" /></span><div><h3>{{ x.t }}</h3><p>{{ x.d }}</p></div></div> }
  </div></section>

  <section class="sec soft" id="services"><div class="wrap"><div class="sh"><h2>One booking site for every kind of trip.</h2><p>{{ d.content.about }}</p></div>
    <div class="grid3">@for (s of d.content.services; track $index) { <article class="svc"><span class="bubble"><app-icon [name]="s.icon" /></span><h3>{{ s.t }}</h3><p>{{ s.d }}</p></article> }</div></div></section>

  <section class="sec" id="fleet"><div class="wrap"><div class="sh"><h2>Pick the car that fits the trip.</h2><p>Every category has a fixed fare formula. You see the full price before you book.</p></div>
    <div class="fleet">@for (k of d.categories; track k.id) {
      <article class="car"><div class="pic"><app-car [type]="k.type" /></div><div class="bd"><h3>{{ k.name }}</h3>
        <div class="specs"><span><app-icon name="user" />{{ k.seats }} guests</span><span><app-icon name="bag" />{{ k.bags }} bags</span></div>
        <p>{{ k.description }}</p><p class="from">From <b>{{ site.money(fromPrice(k)) }}</b> · {{ site.money(k.perKm) }}/km · {{ site.money(k.perHour) }}/hour</p></div></article>
    }</div></div></section>

  <section class="sec soft" id="how"><div class="wrap"><div class="sh"><h2>Booked in under a minute.</h2></div><div class="steps">
    <div class="step"><span class="bubble"><app-icon name="pin" /></span><h3>Tell us the trip</h3><p>Pickup, drop-off, date and guests. One way, round trip, hourly or airport.</p></div>
    <div class="step"><span class="bubble"><app-icon name="car" /></span><h3>Choose your car</h3><p>Compare categories with the full fixed fare, including tax and extras.</p></div>
    <div class="step"><span class="bubble"><app-icon name="ticket" /></span><h3>Ride and relax</h3><p>Get a booking reference instantly. Your driver's details follow before pickup.</p></div></div></div></section>

  @if (d.places.length) {
  <section class="sec" id="cover"><div class="wrap cov"><div class="sh" style="margin:0"><h2>Serving {{ d.brand.city || 'the city' }} and beyond.</h2><p>Popular pickups and destinations. Any other address works too.</p></div>
    <div class="chips">@for (p of d.places; track p.id) { <button class="chip" type="button" (click)="pick(p.name)"><app-icon [name]="p.type === 'airport' ? 'plane' : p.type === 'city' ? 'road' : 'pin'" />{{ p.name }}</button> }</div></div></section>
  }

  <section class="sec soft" id="faq"><div class="wrap"><div class="sh"><h2>Questions, answered.</h2></div>
    <div class="faq">@for (q of d.content.faq; track $index) { <details><summary>{{ q.q }}</summary><p>{{ q.a }}</p></details> }</div></div></section>

  <section class="sec" id="contact"><div class="wrap"><div class="cta"><div><h2>Planning something bigger?</h2><p>Corporate accounts, event transport and long-term hire. Tell us what you need.</p>
    <div class="lines">
      @if (d.brand.phone) { <div><app-icon name="phone" /><a [href]="'tel:' + d.brand.phone.replaceAll(' ', '')">{{ d.brand.phone }}</a></div> }
      @if (d.brand.email) { <div><app-icon name="mail" /><a [href]="'mailto:' + d.brand.email">{{ d.brand.email }}</a></div> }
      @if (d.brand.whatsapp) { <div><app-icon name="chat" /><a [href]="'https://wa.me/' + d.brand.whatsapp.replace(/[^0-9]/g, '')" target="_blank" rel="noopener">WhatsApp {{ d.brand.whatsapp }}</a></div> }
      @if (d.brand.address) { <div><app-icon name="pin" /><span>{{ d.brand.address }}</span></div> }
    </div></div>
    <form (ngSubmit)="enquire()" novalidate>
      <input name="name" [(ngModel)]="enq.name" placeholder="Your name" autocomplete="name" aria-label="Your name">
      <input name="email" type="email" [(ngModel)]="enq.email" placeholder="Email" autocomplete="email" aria-label="Email">
      <input name="phone" type="tel" [(ngModel)]="enq.phone" placeholder="Phone (optional)" autocomplete="tel" aria-label="Phone">
      <textarea name="message" rows="4" [(ngModel)]="enq.message" placeholder="Dates, number of guests, pickup and destination" aria-label="Message"></textarea>
      <input class="hp" name="website" [(ngModel)]="enq.website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="btn p" type="submit" [disabled]="enqBusy()">{{ enqBusy() ? 'Sending…' : 'Send enquiry' }}</button>
      @if (enqMsg()) { <p class="note" style="color:#c9ccd2">{{ enqMsg() }}</p> }
    </form></div></div></section>
  } @else if (!site.error()) { <div class="loading"><span class="spin"></span></div> }
  `,
  styles: [`
    .hero{position:relative}.scene-cars{position:absolute;inset:auto 0 0 0;height:clamp(150px,22vw,260px);pointer-events:none;z-index:1}
    .scene-cars app-car{position:absolute}
    .c1{left:11.9%;bottom:20%;width:10%}.c2{left:55.5%;bottom:21%;width:18%}.c3{left:81.7%;bottom:20%;width:10.7%}
  `],
})
export class Home {
  site = inject(Site);
  private api = inject(Api);
  private router = inject(Router);
  tripTypes = [['oneway', 'One way', 'route'], ['round', 'Round trip', 'swap'], ['hourly', 'By the hour', 'clock'], ['airport', 'Airport', 'plane']];
  back = Array.from({ length: 34 }, (_, i) => [i * 38 - 10, 26 + ((i * 37) % 22), 50 + ((i * 53) % 120)]);
  front = Array.from({ length: 24 }, (_, i) => [i * 54 + 8, 34 + ((i * 29) % 26), 30 + ((i * 41) % 80)]);
  f = signal<TripForm>(this.initial());
  err = signal('');
  enq = { name: '', email: '', phone: '', message: '', website: '' };
  enqBusy = signal(false); enqMsg = signal('');

  maxSeats = computed(() => Math.max(4, ...(this.site.data()?.categories || []).map((c: any) => c.seats)));
  maxBags = computed(() => Math.max(2, ...(this.site.data()?.categories || []).map((c: any) => c.bags)));
  paxList = computed(() => Array.from({ length: this.maxSeats() }, (_, i) => i + 1));
  bagList = computed(() => Array.from({ length: this.maxBags() + 1 }, (_, i) => i));
  hoursList = computed(() => { const m = this.site.data()?.pricing.minHours || 2; return Array.from({ length: 13 - m }, (_, i) => i + m); });

  constructor() {
    // Data loads after navigation, so jump to #fragment once the sections exist.
    this.site.load().then(() => {
      // Default pickup = 3 hours from now in the business's time zone (customers may be abroad).
      if (!this.touched) { const tz = this.site.brand().timezone; try {
        const half = 30 * 60_000, at = Math.ceil((Date.now() + 3 * 3600_000) / half) * half;
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at));
        const g = (t: string) => parts.find((x) => x.type === t)?.value || '00';
        const date = `${g('year')}-${g('month')}-${g('day')}`;
        this.f.update((x) => ({ ...x, date, returnDate: date, time: `${g('hour')}:${g('minute')}` }));
      } catch { /* keep browser time */ } }
      const f = location.hash.slice(1); if (f) setTimeout(() => document.getElementById(f)?.scrollIntoView(), 50); }).catch(() => {});
  }

  private initial(): TripForm {
    const t = new Date(Date.now() + 3 * 3600_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    return { type: 'oneway', pickup: '', dropoff: '', date, time: `${pad(t.getHours())}:${t.getMinutes() < 30 ? '30' : '00'}`, returnDate: date, returnTime: '18:00', hours: 3, pax: 1, bags: 1 };
  }
  private touched = false;
  set<K extends keyof TripForm>(k: K, v: TripForm[K]) { this.touched = true; this.f.update((x) => ({ ...x, [k]: v })); this.err.set(''); }
  setType(t: string) {
    this.set('type', t);
    if (t === 'airport' && !this.f().pickup) { const ap = this.site.data()?.places.find((p) => p.type === 'airport'); if (ap) this.set('pickup', ap.name); }
  }
  swap() { const x = this.f(); this.f.set({ ...x, pickup: x.dropoff, dropoff: x.pickup }); }
  pick(name: string) {
    const x = this.f();
    this.set(x.pickup ? 'dropoff' : 'pickup', name);
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  fromPrice(k: any) { return Math.min(k.minFare, k.base + k.perKm * 5) || k.minFare; }

  go() {
    const x = this.f();
    let e = '';
    if (!x.pickup.trim()) e = 'Please enter a pickup location.';
    else if (x.type !== 'hourly' && !x.dropoff.trim()) e = 'Please enter a drop-off location.';
    else if (!x.date || x.date < this.site.today()) e = 'Please choose today or a later date.';
    else if (!x.time) e = 'Please choose a pickup time.';
    else if (x.type === 'round' && x.returnDate + x.returnTime <= x.date + x.time) e = 'The return must be after the outward trip.';
    if (e) { this.err.set(e); return; }
    const q: any = { type: x.type, pickup: x.pickup.trim(), date: x.date, time: x.time, pax: x.pax, bags: x.bags };
    if (x.type === 'hourly') q.hours = x.hours; else q.dropoff = x.dropoff.trim();
    if (x.type === 'round') { q.returnDate = x.returnDate; q.returnTime = x.returnTime; }
    this.router.navigate(['/book'], { queryParams: q });
  }

  async enquire() {
    const e = this.enq;
    if (!e.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.email.trim()) || !e.message.trim()) { this.enqMsg.set('Please add your name, a valid email and a message.'); return; }
    this.enqBusy.set(true);
    try {
      await this.api.post('public/enquiries', e);
      this.enq = { name: '', email: '', phone: '', message: '', website: '' };
      this.enqMsg.set('Thanks, we have your enquiry and will reply soon.');
    } catch (x: any) { this.enqMsg.set(x.message); }
    this.enqBusy.set(false);
  }
}
