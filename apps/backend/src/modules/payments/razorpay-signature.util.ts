import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time hex-string comparison — a plain `===` leaks timing
 * information proportional to how many leading bytes match, which is
 * exactly the kind of side channel signature verification exists to
 * close. `Buffer.byteLength` mismatches are checked first since
 * `timingSafeEqual` throws (rather than returning `false`) on
 * differing lengths.
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Standard Razorpay Checkout signature: `HMAC-SHA256(order_id + "|" +
 * payment_id, key_secret)`. Verifies that the `razorpay_payment_id`/
 * `razorpay_signature` a client submits to `POST /payments/verify`
 * actually came from Razorpay for *this* `razorpay_order_id` — the
 * client could otherwise submit any payment id it likes.
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  const expected = createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return timingSafeHexEqual(expected, signature);
}

/**
 * Razorpay webhook signature: `HMAC-SHA256(<exact raw request body>,
 * webhook_secret)`, sent in the `X-Razorpay-Signature` header. Must
 * be computed over the literal bytes Razorpay sent — `rawBody` is
 * `req.rawBody`, captured by `app.ts`'s `express.json({ verify })`
 * (see `raw-body.types.ts`), never a re-serialized `req.body`.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  webhookSecret: string,
): boolean {
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return timingSafeHexEqual(expected, signature);
}
