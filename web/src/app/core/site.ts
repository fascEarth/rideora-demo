import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from './api';

export interface SiteData {
  brand: any; content: any; categories: any[]; places: { id: string; name: string; type: string }[]; extras: any[];
  pricing: { taxLabel: string; tax: number; minHours: number; kmPerHour: number; cancelHours: number; minNoticeMinutes: number };
  payments: { card: boolean; provider: string; cash: boolean; account: boolean };
}

export const STATUSES = ['Pending', 'Confirmed', 'Assigned', 'On trip', 'Completed', 'Cancelled'];
export const TYPE_NAMES: Record<string, string> = { oneway: 'One way', round: 'Round trip', hourly: 'By the hour', airport: 'Airport transfer' };
export const PAY_NAMES: Record<string, string> = { card: 'Card', cash: 'Pay the driver', account: 'Corporate account' };
export const PAY_STATUS: Record<string, string> = { unpaid: 'Not paid yet', pending: 'Awaiting payment', paid: 'Paid', refund_due: 'Refund due', refunded: 'Refunded', failed: 'Payment failed' };

function luminance(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 1;
  const c = [0, 2, 4].map((i) => { const v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Website configuration (brand, content, fleet) loaded once and shared by every page. */
@Injectable({ providedIn: 'root' })
export class Site {
  private api = inject(Api);
  readonly data = signal<SiteData | null>(null);
  readonly error = signal('');
  readonly brand = computed(() => this.data()?.brand ?? { name: '', currency: 'USD', locale: 'en-US', primary: '#FFC62B' });
  private loading: Promise<SiteData> | null = null;

  load(force = false): Promise<SiteData> {
    if (this.loading && !force) return this.loading;
    this.loading = this.api.get<SiteData>('public/site').then((d) => {
      this.data.set(d); this.error.set(''); this.applyBrand(d.brand); return d;
    }).catch((e) => { this.error.set(e.message); this.loading = null; throw e; });
    return this.loading;
  }

  applyBrand(b: any) {
    const p = /^#[0-9a-f]{6}$/i.test(b?.primary) ? b.primary : '#FFC62B';
    const r = document.documentElement.style;
    r.setProperty('--p', p);
    r.setProperty('--onp', luminance(p) > 0.42 ? '#121417' : '#FFFFFF');
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', p);
  }

  money(n: number | null | undefined, cur?: string) {
    const b = this.brand();
    const v = Number(n || 0), whole = Number.isInteger(Math.round(v * 100) / 100);
    try { return new Intl.NumberFormat(b.locale || 'en-US', { style: 'currency', currency: cur || b.currency || 'USD', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(v); }
    catch { return `${cur || b.currency} ${v.toFixed(2)}`; }
  }

  date(d: string, t?: string | null) {
    if (!d) return '';
    try {
      const s = new Date(d + 'T12:00:00').toLocaleDateString(this.brand().locale || 'en', { weekday: 'short', day: 'numeric', month: 'short' });
      return t ? `${s} · ${t}` : s;
    } catch { return t ? `${d} ${t}` : d; }
  }

  /** Today's date in the business's own time zone, so customers abroad see the right day. */
  today(): string {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: this.brand().timezone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch { return new Date().toISOString().slice(0, 10); }
  }
}
