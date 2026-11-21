import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, isNight, roadKm, PricingRules } from '../pricing/quote';
import { minorUnits } from '../services/payment.service';

const rules: PricingRules = { taxLabel: 'VAT', tax: 5, airportFee: 25, nightPct: 20, nightStart: 22, nightEnd: 6, roundDisc: 10, minHours: 2, kmPerHour: 20, cancelHours: 2, minNoticeMinutes: 60 };
const cat = { name: 'Sedan', base: 25, perKm: 2, perHour: 70, minFare: 50 };
const extras = [{ id: 'seat', name: 'Child seat', price: 20 }];
const base = { type: 'oneway' as const, km: 10, hours: 0, time: '12:00', airport: false, extras: {} };

test('one-way fare is base + per km, plus tax', () => {
  const q = quote(rules, cat, base, extras, []);
  assert.equal(q.total, 52.5); // max(min 50, 25 + 2×10) = 50, plus 5% tax
});
test('minimum fare applies', () => {
  assert.equal(quote({ ...rules, tax: 0 }, cat, { ...base, km: 1 }, extras, []).total, 50);
});
test('round trip doubles and discounts', () => {
  const q = quote({ ...rules, tax: 0 }, cat, { ...base, type: 'round', km: 20 }, extras, []);
  assert.equal(q.total, (25 + 40) * 2 * 0.9);
});
test('airport fee and night surcharge', () => {
  const q = quote({ ...rules, tax: 0 }, cat, { ...base, km: 20, airport: true, time: '23:30' }, extras, []);
  assert.equal(q.total, (65 + 25) * 1.2);
});
test('hourly uses minimum hours', () => {
  assert.equal(quote({ ...rules, tax: 0, nightPct: 0 }, cat, { ...base, type: 'hourly', hours: 1 }, extras, []).total, 140);
});
test('extras and percentage promo', () => {
  const q = quote({ ...rules, tax: 0 }, cat, { ...base, km: 20, extras: { seat: 2 }, promo: 'save10' }, extras, [{ code: 'SAVE10', kind: 'pct', value: 10, active: true }]);
  assert.equal(q.promoOk, 'SAVE10');
  assert.equal(q.total, (65 + 40) * 0.9);
});
test('inactive, expired and used-up promos are rejected', () => {
  const p = { code: 'X', kind: 'flat' as const, value: 5, active: true };
  assert.equal(quote(rules, cat, { ...base, promo: 'x' }, extras, [{ ...p, active: false }]).promoOk, false);
  assert.equal(quote(rules, cat, { ...base, promo: 'x', date: '2030-01-02' }, extras, [{ ...p, validUntil: '2030-01-01' }]).promoOk, false);
  assert.equal(quote(rules, cat, { ...base, promo: 'x' }, extras, [{ ...p, maxUses: 3, used: 3 }]).promoOk, false);
});
test('flat promo never makes the fare negative', () => {
  assert.equal(quote({ ...rules, tax: 0 }, cat, { ...base, promo: 'big' }, extras, [{ code: 'BIG', kind: 'flat', value: 999, active: true }]).total, 0);
});
test('night window crossing midnight', () => {
  assert.equal(isNight('23:00', 22, 6), true);
  assert.equal(isNight('05:59', 22, 6), true);
  assert.equal(isNight('06:00', 22, 6), false);
  assert.equal(isNight('13:00', 12, 14), true);
});
test('road distance and minor units', () => {
  assert.ok(Math.abs(roadKm({ lat: 25.2532, lng: 55.3657 }, { lat: 25.0805, lng: 55.1403 }) - 39) <= 2);
  assert.equal(minorUnits(10.5, 'INR'), 1050);
  assert.equal(minorUnits(1000, 'JPY'), 1000);
  assert.equal(minorUnits(1.234, 'KWD'), 1230);
});
