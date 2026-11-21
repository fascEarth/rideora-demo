import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';

process.env.RAZORPAY_KEY_SECRET = 'test_secret';
process.env.PAYMENT_PROVIDER = 'razorpay';

test('Razorpay signature: valid accepted, tampered rejected', async () => {
  const { PaymentService } = await import('../services/payment.service');
  const p = new PaymentService();
  const sig = createHmac('sha256', 'test_secret').update('order_1|pay_1').digest('hex');
  assert.equal(p.verifyRazorpay('order_1', 'pay_1', sig), true);
  assert.equal(p.verifyRazorpay('order_1', 'pay_2', sig), false);
  assert.equal(p.verifyRazorpay('order_1', 'pay_1', 'x'), false);
});
