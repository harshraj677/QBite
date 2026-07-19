import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';

/**
 * Field-level *format* validation lives here (Zod, at the request
 * boundary) — cross-field/business rules (ownership, one-success-per-
 * order, signature verification, forward-only transitions) live in
 * PaymentsService. Same split as every other module.
 */

export const createPaymentOrderSchema = z.object({
  orderId: objectIdSchema,
});
export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;

// Deliberately just the three fields Razorpay Checkout's own success
// callback hands the client — no `orderId` here; PaymentsService
// derives it from the stored Payment record via razorpayOrderId. No
// `amount` either — nothing about the amount is ever re-confirmed
// from the client at verify time; it was already fixed, server-side,
// at create-order time.
export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const paymentIdParamSchema = z.object({
  id: objectIdSchema,
});
export type PaymentIdParam = z.infer<typeof paymentIdParamSchema>;

export const paymentOrderIdParamSchema = z.object({
  orderId: objectIdSchema,
});
export type PaymentOrderIdParam = z.infer<typeof paymentOrderIdParamSchema>;

// Deliberately loose: Razorpay's webhook payload shape varies per
// event type (see PaymentsService's per-event field extraction), and
// modeling every event's full schema here would be brittle against a
// gateway we don't control. This only guarantees the envelope every
// event shares — `event` (the type string) and `payload` (an object,
// dispatched on inside the service). Signature verification (using
// req.rawBody, independent of this parsed shape) is what actually
// gates trust, not this schema.
export const webhookEventSchema = z.object({
  event: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});
export type WebhookEventInput = z.infer<typeof webhookEventSchema>;
