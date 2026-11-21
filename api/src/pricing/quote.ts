/** Fare calculation. Pure functions: the server is the only place a price is decided. */

export interface PricingRules {
  taxLabel: string;
  tax: number;            // percent
  airportFee: number;
  nightPct: number;       // percent
  nightStart: number;     // hour 0-23
  nightEnd: number;       // hour 0-23
  roundDisc: number;      // percent off a round trip
  minHours: number;
  kmPerHour: number;
  cancelHours: number;    // customers may cancel online until this many hours before pickup
  minNoticeMinutes: number;
}

export interface CategoryRate { name: string; base: number; perKm: number; perHour: number; minFare: number }
export interface ExtraDef { id: string; name: string; price: number; active?: boolean }
export interface PromoDef { code: string; kind: 'pct' | 'flat'; value: number; active: boolean; maxUses?: number | null; validUntil?: string | null; used?: number }

export interface TripInput {
  type: 'oneway' | 'round' | 'hourly' | 'airport';
  km: number;
  hours: number;
  time: string;          // HH:mm
  date?: string;         // YYYY-MM-DD, for promo expiry
  airport: boolean;      // pickup or drop-off is an airport
  extras: Record<string, number>;
  promo?: string;
}

export interface Quote { lines: [string, number][]; total: number; promoOk: string | null | false }

const r2 = (x: number) => Math.round(x * 100) / 100;

export function isNight(time: string, start: number, end: number): boolean {
  const hr = Number(String(time || '12:00').split(':')[0]);
  if (Number.isNaN(hr) || start === end) return false;
  return start > end ? hr >= start || hr < end : hr >= start && hr < end;
}

export function promoValid(p: PromoDef | undefined, date?: string): boolean {
  if (!p || !p.active) return false;
  if (p.validUntil && date && date > p.validUntil) return false;
  if (p.maxUses && (p.used || 0) >= p.maxUses) return false;
  return true;
}

export function quote(rules: PricingRules, cat: CategoryRate, t: TripInput, extras: ExtraDef[], promos: PromoDef[]): Quote {
  const L: [string, number][] = [];
  let fare: number;
  if (t.type === 'hourly') {
    const h = Math.max(rules.minHours, Math.round(t.hours || rules.minHours));
    fare = h * cat.perHour;
    L.push([`${h} hours, up to ${h * rules.kmPerHour} km`, r2(fare)]);
  } else {
    const km = Math.max(1, Math.round((t.km || 0) * 10) / 10);
    const one = Math.max(cat.minFare, cat.base + cat.perKm * km);
    L.push([`${km} km trip`, r2(one)]);
    fare = one;
    if (t.type === 'round') {
      L.push(['Return trip', r2(one)]);
      fare = one * 2;
      if (rules.roundDisc > 0) {
        const d = -fare * rules.roundDisc / 100;
        L.push([`Round-trip saving ${rules.roundDisc}%`, r2(d)]);
        fare += d;
      }
    }
    if ((t.type === 'airport' || t.airport) && rules.airportFee > 0) {
      L.push(['Airport fee', r2(rules.airportFee)]);
      fare += rules.airportFee;
    }
  }
  if (rules.nightPct > 0 && isNight(t.time, rules.nightStart, rules.nightEnd)) {
    const n = fare * rules.nightPct / 100;
    L.push([`Night surcharge ${rules.nightPct}%`, r2(n)]);
    fare += n;
  }
  for (const [id, qtyRaw] of Object.entries(t.extras || {})) {
    const qty = Math.max(0, Math.min(10, Math.floor(Number(qtyRaw) || 0)));
    const x = extras.find((e) => e.id === id && e.active !== false);
    if (x && qty > 0) {
      L.push([x.name + (qty > 1 ? ` × ${qty}` : ''), r2(x.price * qty)]);
      fare += x.price * qty;
    }
  }
  let promoOk: string | null | false = null;
  if (t.promo && t.promo.trim()) {
    const code = t.promo.trim().toUpperCase();
    const p = promos.find((p) => p.code.toUpperCase() === code);
    if (promoValid(p, t.date)) {
      const d = p.kind === 'pct' ? fare * Math.min(100, p.value) / 100 : Math.min(fare, p.value);
      L.push([`Promo ${p.code}`, r2(-d)]);
      fare -= d;
      promoOk = p.code;
    } else promoOk = false;
  }
  if (rules.tax > 0) {
    const tax = fare * rules.tax / 100;
    L.push([`${rules.taxLabel} ${rules.tax}%`, r2(tax)]);
    fare += tax;
  }
  return { lines: L, total: r2(Math.max(0, fare)), promoOk };
}

/** Great-circle distance × road factor, rounded to whole km. */
export function roadKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, t = (x: number) => (x * Math.PI) / 180;
  const dl = t(b.lat - a.lat), dn = t(b.lng - a.lng);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dn / 2) ** 2;
  return Math.max(2, Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3));
}
