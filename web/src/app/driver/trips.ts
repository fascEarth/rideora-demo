import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../core/api';
import { Site, TYPE_NAMES } from '../core/site';
import { Badge, Mark, Ui } from '../core/ui';

/** Phone-first view for drivers: today's and upcoming trips, start and complete. */
@Component({
  selector: 'app-driver-trips',
  imports: [Badge, Mark],
  template: `<header class="top"><div class="wrap"><span class="brand"><app-mark />{{ site.brand().name }}</span>
    <div class="row"><button class="btn ghost sm" (click)="load()">Refresh</button><button class="btn dark sm" (click)="logout()">Sign out</button></div></div></header>
  <section class="sec" style="padding-top:20px"><div class="wrap narrow">
    <h1 style="font-size:28px;font-weight:800">Hi {{ api.user()?.name?.split(' ')?.[0] }}</h1><p class="muted" style="margin-bottom:16px">Your assigned trips. The list updates every minute.</p>
    @if (err()) { <p class="err">{{ err() }}</p> }
    <div class="list-gap">@for (t of trips(); track t.ref) {
      <div class="trip-card"><div class="row" style="justify-content:space-between"><span class="t">{{ site.date(t.date, t.time) }}</span><app-badge [value]="t.status" /></div>
        <span><b>{{ t.pickup }}</b>{{ t.dropoff ? ' → ' + t.dropoff : ' · ' + t.hours + ' hours' }}</span>
        <span class="muted">{{ types[t.type] }} · {{ t.categoryName }}{{ t.vehicle ? ' · ' + t.vehicle : '' }} · {{ t.pax }} guests, {{ t.bags }} bags · {{ t.ref }}</span>
        <span>{{ t.name }} · <a [href]="'tel:' + t.phone">{{ t.phone }}</a>{{ t.flight ? ' · flight ' + t.flight : '' }}</span>
        @if (t.notes) { <span class="muted">Note: {{ t.notes }}</span> }
        <span class="muted">{{ t.payMethod === 'cash' && t.payStatus !== 'paid' ? 'Collect ' + site.money(t.total, t.currency) : 'Already paid / on account' }}</span>
        <div class="row mt">
          <a class="btn ghost sm" target="_blank" rel="noopener" [href]="maps(t)">Directions</a>
          @if (t.status === 'Assigned') { <button class="btn p sm" (click)="set(t, 'On trip')">Start trip</button> }
          @if (t.status === 'On trip') { <button class="btn dark sm" (click)="set(t, 'Completed')">Complete trip</button> }
        </div></div>
    } @empty { <div class="empty">No trips assigned to you right now.</div> }</div>
  </div></section>`,
})
export class DriverTrips implements OnInit, OnDestroy {
  api = inject(Api); site = inject(Site); private ui = inject(Ui); private router = inject(Router);
  trips = signal<any[]>([]); err = signal(''); types = TYPE_NAMES; private timer: any;
  ngOnInit() { this.site.load().catch(() => {}); this.load(); this.timer = setInterval(() => this.load(), 60_000); }
  ngOnDestroy() { clearInterval(this.timer); }
  async load() { try { this.trips.set(await this.api.get('driver/trips')); this.err.set(''); } catch (e: any) { this.err.set(e.message); } }
  maps(t: any) { const q = encodeURIComponent(t.status === 'On trip' && t.dropoff ? t.dropoff : t.pickup); return `https://www.google.com/maps/dir/?api=1&destination=${q}`; }
  async set(t: any, status: string) {
    if (status === 'Completed' && !(await this.ui.confirm('Mark this trip as completed?', 'Complete', false))) return;
    try { await this.api.patch(`driver/trips/${t.ref}`, { status }); this.ui.toast(status === 'On trip' ? 'Trip started' : 'Trip completed'); this.load(); } catch (e: any) { this.ui.toast(e.message); }
  }
  logout() { this.api.clear(); this.router.navigateByUrl('/driver/login'); }
}
