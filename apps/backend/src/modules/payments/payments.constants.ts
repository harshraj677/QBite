import type { PaymentStatus } from './payment.types';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** India-only campus canteen — no currency choice is exposed anywhere; every Razorpay order is created in this currency. */
export const DEFAULT_CURRENCY = 'INR';

/**
 * Forward pipeline, same convention and same enforcement pattern as
 * `orders.constants.ts`'s `FORWARD_TRANSITIONS`: `PaymentsService`
 * looks up the payment's *current* status here to find the legal next
 * statuses; the atomic repository update then re-asserts that exact
 * current status as a race guard (see `PaymentsRepository.updateStatus`).
 *
 * `CREATED`'s three-way fan-out (`PENDING`/`SUCCESS`/`FAILED`) is
 * deliberate — see `payment.types.ts`'s doc comment on `PaymentStatus`
 * for why the synchronous verify flow skips `PENDING` entirely.
 */
export const PAYMENT_FORWARD_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ['PENDING', 'SUCCESS', 'FAILED'],
  PENDING: ['SUCCESS', 'FAILED'],
  SUCCESS: ['REFUNDED'],
  FAILED: [],
  REFUNDED: [],
};
