import { createHmac } from 'node:crypto';

import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay-signature.util';

const keySecret = 'test-key-secret';
const webhookSecret = 'test-webhook-secret';

describe('verifyPaymentSignature', () => {
  it('accepts a correctly computed signature', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(verifyPaymentSignature(orderId, paymentId, signature, keySecret)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', 'wrong-secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(verifyPaymentSignature(orderId, paymentId, signature, keySecret)).toBe(false);
  });

  it('rejects a tampered paymentId (signature was computed for a different one)', () => {
    const orderId = 'order_ABC123';
    const signature = createHmac('sha256', keySecret)
      .update(`${orderId}|pay_ORIGINAL`)
      .digest('hex');

    expect(verifyPaymentSignature(orderId, 'pay_TAMPERED', signature, keySecret)).toBe(false);
  });

  it('rejects a malformed (non-hex) signature without throwing', () => {
    expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', 'not-hex-!!', keySecret)).toBe(
      false,
    );
  });

  it('rejects an empty signature without throwing', () => {
    expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', '', keySecret)).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  it('accepts a correctly computed signature over the exact raw body', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
    const signature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    expect(verifyWebhookSignature(rawBody, signature, webhookSecret)).toBe(true);
  });

  it('rejects when the body differs from what was signed by even one byte', () => {
    const signedBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
    const signature = createHmac('sha256', webhookSecret).update(signedBody).digest('hex');
    const tamperedBody = Buffer.from(
      JSON.stringify({ event: 'payment.captured', payload: { x: 1 } }),
    );

    expect(verifyWebhookSignature(tamperedBody, signature, webhookSecret)).toBe(false);
  });

  it('rejects a signature computed with the wrong webhook secret', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
    const signature = createHmac('sha256', 'wrong-secret').update(rawBody).digest('hex');

    expect(verifyWebhookSignature(rawBody, signature, webhookSecret)).toBe(false);
  });

  it('rejects a malformed (non-hex) signature without throwing', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    expect(verifyWebhookSignature(rawBody, 'zzz-not-hex', webhookSecret)).toBe(false);
  });
});
