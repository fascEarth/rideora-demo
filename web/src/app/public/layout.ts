import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Site } from '../core/site';
import { Icon, Mark } from '../core/ui';

/** Header and footer around every public page. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, Icon, Mark],
  template: `
    <header class="top"><div class="wrap">
      <a class="brand" routerLink="/"><app-mark />{{ site.brand().name }}</a>
      <nav class="nav" [class.open]="menu()" (click)="menu.set(false)" aria-label="Main">
        <a routerLink="/" fragment="services">Services</a><a routerLink="/" fragment="fleet">Fleet</a><a routerLink="/" fragment="how">How it works</a>
        <a routerLink="/" fragment="faq">FAQ</a><a routerLink="/" fragment="contact">Contact</a><a routerLink="/manage">Manage booking</a>
      </nav>
      <div class="row">
        @if (site.brand().phone) { <a class="btn ghost sm hide-sm" [href]="'tel:' + site.brand().phone.replace(' ', '')"><app-icon name="phone" />{{ site.brand().phone }}</a> }
        <a class="btn dark sm" routerLink="/" fragment="book">Book a ride</a>
        <button class="menu" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-label="Menu"><app-icon name="menu" /></button>
      </div>
    </div></header>
    <main class="page">
      @if (site.error() && !site.data()) { <div class="wrap"><p class="err">{{ site.error() }}</p><button class="btn dark" (click)="site.load(true)">Try again</button></div> }
      <router-outlet />
    </main>
    <footer class="foot"><div class="wrap">
      <span>© {{ year }} {{ site.brand().name }}. {{ site.brand().tagline }}</span>
      <span class="row"><a routerLink="/manage">Manage booking</a><a routerLink="/terms">Terms</a><a routerLink="/admin">Staff login</a><a routerLink="/driver">Drivers</a></span>
    </div></footer>
  `,
})
export class PublicLayout {
  site = inject(Site);
  menu = signal(false);
  year = new Date().getFullYear();
  constructor() {
    this.site.load().catch(() => {});
  }
}

@Component({
  selector: 'app-terms',
  template: `<section class="sec"><div class="wrap narrow"><h1 style="font-size:36px;font-weight:800;margin-bottom:18px">Terms of booking</h1>
    <p style="white-space:pre-wrap">{{ site.data()?.content?.terms }}</p>
    <p class="note mt">Online cancellations are possible until {{ site.data()?.pricing?.cancelHours }} hours before pickup.</p></div></section>`,
})
export class Terms { site = inject(Site); }
