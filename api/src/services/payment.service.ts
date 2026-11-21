import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';
import { Booking } from '../entities';

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'XAF', 'XOF', 'UGX', 'RWF', 'PYG', 'ISK']);
const THREE_DECIMAL = new Set(['KWD', 'BHD', 'OMR', 'JOD', 'TND']);
export const minorUnits = (amount: number, currency: string) => {
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL.has(c)) return Math.round(amount);
  if (THREE_DECIMAL.has(c)) return Math.round(amount * 100) * 10; // Stripe requires the last digit to be 0
  return Math.round(amount * 100);
};

export type PaymentStart =
  | { provider: 'razorpay'; keyId: string; orderId: string; amount: number; currency: string }
  | { provider: 'stripe'; url: string };

/** Card payments through Razorpay (India) or Stripe (international). Keys stay on the server. */
@Injectable()
export class PaymentService {
  private log = new Logger('Payments');
  get provider() { return config.payments.provider; }
  get enabled() { return this.provider !== 'none'; }

  async start(b: Booking, brandName: string): Promise<PaymentStart> {
    if (this.provider === 'razorpay') {
      const order = await this.razorpay('POST', '/v1/orders', { amount: minorUnits(b.total, b.currency), currency: b.currency, receipt: b.ref, notes: { ref: b.ref } });
      b.payOrder = order.id;
      return { provider: 'razorpay', keyId: config.payments.razorpayKeyId, orderId: order.id, amount: order.amount, currency: order.currency };
    }
    if (this.provider === 'stripe') {
      const f = new URLSearchParams();
      f.set('mode', 'payment');
      f.set('success_url', `${config.appUrl}/booking/paid?ref=${b.ref}&session_id={CHECKOUT_SESSION_ID}`);
      f.set('cancel_url', `${config.appUrl}/booking/paid?ref=${b.ref}&cancelled=1`);
      f.set('customer_email', b.email);
      f.set('client_reference_id', b.ref);
      f.set('metadata[ref]', b.ref);
      f.set('line_items[0][quantity]', '1');
      f.set('line_items[0][price_data][currency]', b.currency.toLowerCase());
      f.set('line_items[0][price_data][unit_amount]', String(minorUnits(b.total, b.currency)));
      f.set('line_items[0][price_data][product_data][name]', `${brandName} booking ${b.ref}`);
      f.set('line_items[0][price_data][product_data][description]', `${b.categoryName}: ${b.pickup}${b.dropoff ? ' to ' + b.dropoff : ''}, ${b.date} ${b.time}`.slice(0, 300));
      const s = await this.stripe('POST', '/v1/checkout/sessions', f);
      b.payOrder = s.id;
      return { provider: 'stripe', url: s.url };
    }
    throw new BadGatewayException('Online payment is not set up');
  }

  /** Razorpay checkout returns order id, payment id and a signature we verify with the secret. */
  verifyRazorpay(orderId: string, paymentId: string, signature: string) {
    const expected = createHmac('sha256', config.payments.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(String(signature || ''));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async stripeSession(id: string) { return this.stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(id)}`); }

  async refund(b: Booking) {
    if (b.payProvider === 'razorpay') {
      await this.razorpay('POST', `/v1/payments/${encodeURIComponent(b.payRef)}/refund`, { amount: minorUnits(b.total, b.currency), notes: { ref: b.ref } });
    } else if (b.payProvider === 'stripe') {
      const f = new URLSearchParams(); f.set('payment_intent', b.payRef); f.set('metadata[ref]', b.ref);
      await this.stripe('POST', '/v1/refunds', f);
    } else throw new BadGatewayException('This booking was not paid online');
  }

  private async razorpay(method: string, path: string, body?: any) {
    const auth = Buffer.from(`${config.payments.razorpayKeyId}:${config.payments.razorpayKeySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com' + path, { method, headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { this.log.error(`Razorpay ${path} ${res.status} ${JSON.stringify(j).slice(0, 300)}`); throw new BadGatewayException(j?.error?.description || 'Payment provider error'); }
    return j;
  }

  private async stripe(method: string, path: string, form?: URLSearchParams) {
    const res = await fetch('https://api.stripe.com' + path, { method, headers: { Authorization: `Bearer ${config.payments.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form ? form.toString() : undefined, signal: AbortSignal.timeout(15000) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { this.log.error(`Stripe ${path} ${res.status} ${JSON.stringify(j).slice(0, 300)}`); throw new BadGatewayException(j?.error?.message || 'Payment provider error'); }
    return j;
  }
}
