import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from '../core/api';
import { Site } from '../core/site';
import { Icon, Mark } from '../core/ui';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Mark, RouterLink],
  template: `<div class="login"><form class="card" (ngSubmit)="go()" novalidate>
    <a class="brand" routerLink="/"><app-mark />{{ site.brand().name }}</a>
    <h1>{{ driver ? 'Driver sign in' : 'Sign in to the CMS' }}</h1>
    <p>{{ driver ? 'See your trips and update them on the road.' : 'Manage bookings, dispatch, fleet, pricing and your website.' }}</p>
    <div class="form" style="grid-template-columns:1fr">
      <label class="fl"><span>Email</span><input name="email" type="email" [(ngModel)]="email" autocomplete="username"></label>
      <label class="fl"><span>Password</span><input name="password" type="password" [(ngModel)]="password" autocomplete="current-password"></label>
      @if (err()) { <p class="errmsg" role="alert">{{ err() }}</p> }
      <button class="btn dark" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button></div>
    <p class="note mt"><a routerLink="/">← Back to website</a></p></form></div>`,
})
export class Login {
  site = inject(Site); private api = inject(Api); private router = inject(Router); private route = inject(ActivatedRoute);
  driver = this.router.url.startsWith('/driver');
  email = ''; password = ''; err = signal(''); busy = signal(false);
  constructor() { this.site.load().catch(() => {}); }
  async go() {
    this.busy.set(true); this.err.set('');
    try {
      const u = await this.api.login(this.email.trim(), this.password);
      const next = this.route.snapshot.queryParamMap.get('next');
      if (u.role === 'driver') this.router.navigateByUrl('/driver');
      else this.router.navigateByUrl(next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin');
    } catch (e: any) { this.err.set(e.message); }
    this.busy.set(false);
  }
}

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Mark],
  template: `<div class="adm"><aside class="side">
    <div class="brand"><app-mark />{{ site.brand().name }} <small>CMS</small></div>
    <nav aria-label="CMS">@for (n of nav(); track n[0]) {
      <a [routerLink]="n[0]" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: n[0] === '/admin' }" class="nb"><app-icon [name]="n[2]" />{{ n[1] }}</a> }</nav>
    <div class="side-f"><span class="who">{{ api.user()?.name }} · {{ api.user()?.role }}</span><a routerLink="/" target="_blank">View website ↗</a><button (click)="logout()">Sign out</button></div>
  </aside><main class="am"><router-outlet /></main></div>`,
  styles: [`.nb{display:flex;align-items:center;gap:10px;color:#c4c8cf;padding:10px 12px;border-radius:10px;font-weight:600;font-size:14.5px;min-height:42px;text-decoration:none;flex:none}
    .nb:hover{background:#1f2227;color:#fff}.nb.on{background:var(--p);color:var(--onp)}.who{color:#8b9099;font-size:13px;padding:0 4px}`],
})
export class AdminShell {
  api = inject(Api); site = inject(Site); private router = inject(Router);
  private all: [string, string, string, boolean][] = [
    ['/admin', 'Dashboard', 'grid', false], ['/admin/bookings', 'Bookings', 'list', false], ['/admin/dispatch', 'Dispatch', 'kan', false], ['/admin/enquiries', 'Enquiries', 'inbox', false],
    ['/admin/vehicles', 'Vehicles', 'car', false], ['/admin/drivers', 'Drivers', 'id', false], ['/admin/pricing', 'Fleet & pricing', 'money', true], ['/admin/promos', 'Promotions', 'tag', true],
    ['/admin/places', 'Places', 'pin', true], ['/admin/content', 'Website content', 'doc', true], ['/admin/brand', 'Branding', 'brush', true], ['/admin/users', 'Staff logins', 'users', true], ['/admin/settings', 'Settings', 'gear', true],
  ];
  nav = computed(() => this.all.filter((n) => !n[3] || this.api.user()?.role === 'admin'));
  constructor() { this.site.load().catch(() => {}); }
  logout() { this.api.clear(); this.router.navigateByUrl('/admin/login'); }
}

/** Page heading used by every CMS screen. */
@Component({
  selector: 'app-head',
  template: `<div class="am-h"><div><h1>{{ title() }}</h1>@if (sub()) {<p>{{ sub() }}</p>}</div><div class="row"><ng-content /></div></div>`,
})
export class Head { title = input(''); sub = input(''); }
