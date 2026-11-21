import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { config } from '../config';
import { Place, Setting } from '../entities';
import { roadKm, PricingRules } from '../pricing/quote';

/* ---------------- settings ---------------- */
@Injectable()
export class SettingsService {
  private cache = new Map<string, any>();
  constructor(@InjectRepository(Setting) private repo: Repository<Setting>) {}

  async get<T = any>(key: string, fallback: T = {} as T): Promise<T> {
    if (this.cache.has(key)) return this.cache.get(key);
    const row = await this.repo.findOne({ where: { key } });
    const v = row ? row.value : fallback;
    this.cache.set(key, v);
    return v;
  }
  async set(key: string, value: any) {
    await this.repo.save({ key, value });
    this.cache.set(key, value);
    return value;
  }
  brand() { return this.get<any>('brand'); }
  content() { return this.get<any>('content'); }
  pricing() { return this.get<PricingRules & { payCash: boolean; payAccount: boolean; payCard: boolean }>('pricing'); }
}

/* ---------------- distance ---------------- */
export interface DistanceResult { km: number; source: 'maps' | 'places' | 'estimate'; minutes?: number }

@Injectable()
export class DistanceService {
  private log = new Logger('Distance');
  private memo = new Map<string, DistanceResult>();
  constructor(@InjectRepository(Place) private places: Repository<Place>) {}

  async findPlace(name: string) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return this.places.createQueryBuilder('p').where('lower(p.name) = :n', { n }).getOne();
  }

  async isAirport(name: string) { const p = await this.findPlace(name); return !!p && p.type === 'airport'; }

  /** Google Routes when a key is configured, otherwise saved place coordinates, otherwise the customer's estimate. */
  async between(from: string, to: string, hintKm?: number): Promise<DistanceResult> {
    const key = `${from}|${to}`.toLowerCase();
    if (this.memo.has(key)) return this.memo.get(key);
    const [a, b] = await Promise.all([this.findPlace(from), this.findPlace(to)]);
    let res: DistanceResult | null = null;
    if (config.googleMapsKey) res = await this.google(a, b, from, to);
    if (!res && a?.lat != null && b?.lat != null) res = { km: roadKm(a as any, b as any), source: 'places' };
    if (res) { if (this.memo.size > 2000) this.memo.clear(); this.memo.set(key, res); return res; }
    const km = Math.max(1, Math.min(2000, Math.round(Number(hintKm) || 15)));
    return { km, source: 'estimate' };
  }

  private async google(a: Place | null, b: Place | null, from: string, to: string): Promise<DistanceResult | null> {
    const wp = (p: Place | null, text: string) => (p?.lat != null ? { location: { latLng: { latitude: p.lat, longitude: p.lng } } } : { address: text });
    try {
      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': config.googleMapsKey, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' },
        body: JSON.stringify({ origin: wp(a, from), destination: wp(b, to), travelMode: 'DRIVE' }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) { this.log.warn(`Routes API ${res.status}: ${(await res.text()).slice(0, 200)}`); return null; }
      const j: any = await res.json();
      const r = j.routes?.[0];
      if (!r?.distanceMeters) return null;
      return { km: Math.max(1, Math.round(r.distanceMeters / 100) / 10), source: 'maps', minutes: Math.round(parseInt(r.duration || '0', 10) / 60) };
    } catch (e) {
      this.log.warn('Routes API failed: ' + (e as Error).message);
      return null;
    }
  }
}

/* ---------------- email ---------------- */
@Injectable()
export class MailService {
  private log = new Logger('Mail');
  private transport = config.smtp.host
    ? nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined })
    : null;
  constructor(private settings: SettingsService) {}

  get enabled() { return !!this.transport; }

  /** Sends in the background; email problems never break a booking. */
  send(to: string, subject: string, html: string, replyTo?: string) {
    if (!to) return;
    if (!this.transport) { this.log.log(`(email disabled) to=${to} subject="${subject}"`); return; }
    (async () => {
      const brand = await this.settings.brand();
      const from = config.smtp.from || `${brand.name} <${config.smtp.user}>`;
      await this.transport.sendMail({ from, to, subject, html: await this.wrap(html), replyTo: replyTo || brand.email || undefined });
    })().catch((e) => this.log.error(`Email to ${to} failed: ${e.message}`));
  }

  private async wrap(body: string) {
    const b = await this.settings.brand();
    const esc = (s: string) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<!doctype html><html><body style="margin:0;background:#f5f6f7;font-family:Arial,Helvetica,sans-serif;color:#121417">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:${esc(b.primary || '#FFC62B')};padding:18px 24px;font-size:20px;font-weight:bold">${esc(b.name)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #eee;font-size:13px;color:#6b717b">${esc(b.name)}${b.phone ? ' · ' + esc(b.phone) : ''}${b.email ? ' · ' + esc(b.email) : ''}<br>${esc(config.appUrl)}</td></tr>
</table></td></tr></table></body></html>`;
  }
}
