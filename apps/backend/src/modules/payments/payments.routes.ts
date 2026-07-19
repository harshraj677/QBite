import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { PaymentsController } from './payments.controller';
import {
  createPaymentOrderSchema,
  paymentIdParamSchema,
  paymentOrderIdParamSchema,
  verifyPaymentSchema,
  webhookEventSchema,
} from './payments.validation';

export const paymentsRouter = Router();
const controller = new PaymentsController();

/**
 * @openapi
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         orderId: { type: string }
 *         userId: { type: string }
 *         razorpayOrderId: { type: string }
 *         razorpayPaymentId: { type: string }
 *         amount: { type: integer, description: "Integer, paise. Always copied from Order.totalAmount — never client-supplied." }
 *         currency: { type: string, example: INR }
 *         status: { type: string, enum: [CREATED, PENDING, SUCCESS, FAILED, REFUNDED] }
 *         paymentMethod: { type: string, description: "Razorpay's own vocabulary (card, upi, netbanking, ...) — populated from Razorpay's response when available." }
 *         transactionId: { type: string }
 *         failureReason: { type: string }
 *         refundedAmount: { type: integer, description: "Integer, paise. Set on REFUNDED; may be less than amount for a partial refund." }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/v1/payments/create-order:
 *   post:
 *     summary: Create a Razorpay order for an existing QBite order
 *     description: Student only, and only the order's own student. Amount is always Order.totalAmount — there is no `amount` field to send. Fails with 409 if the order is already paid or a SUCCESS payment already exists for it.
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: string }
 *     responses:
 *       201:
 *         description: Razorpay order created; a Payment record was created in CREATED status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { payment: { $ref: '#/components/schemas/Payment' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: A student requesting a payment order for someone else's order, or a non-student role.
 *       404:
 *         description: Order not found.
 *       409:
 *         description: Order already paid, or a SUCCESS payment already exists for it.
 */
paymentsRouter.post(
  '/create-order',
  authenticate(),
  requireRole('student'),
  validateRequest({ body: createPaymentOrderSchema }),
  controller.createOrder,
);

/**
 * @openapi
 * /api/v1/payments/verify:
 *   post:
 *     summary: Verify a completed Razorpay Checkout payment
 *     description: Student only — must be the payment's own owner. Verifies the HMAC-SHA256 signature Razorpay Checkout returns before marking the payment SUCCESS. Idempotent — calling this again for an already-resolved payment returns its current state without re-verifying.
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpayOrderId, razorpayPaymentId, razorpaySignature]
 *             properties:
 *               razorpayOrderId: { type: string }
 *               razorpayPaymentId: { type: string }
 *               razorpaySignature: { type: string }
 *     responses:
 *       200:
 *         description: Payment verified and marked SUCCESS (or already-resolved state returned unchanged).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { payment: { $ref: '#/components/schemas/Payment' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: The payment belongs to a different user.
 *       404:
 *         description: No payment matches the given razorpayOrderId.
 *       422:
 *         description: Signature verification failed — the payment was marked FAILED.
 */
paymentsRouter.post(
  '/verify',
  authenticate(),
  requireRole('student'),
  validateRequest({ body: verifyPaymentSchema }),
  controller.verify,
);

/**
 * @openapi
 * /api/v1/payments/webhook:
 *   post:
 *     summary: Razorpay webhook receiver
 *     description: Server-to-server only — no bearer token. Trust is established entirely by the `X-Razorpay-Signature` header, verified against the raw request body using the webhook secret (HMAC-SHA256). Handles `payment.captured`, `payment.failed`, `refund.processed`; any other event is ignored safely. Always idempotent — a retried delivery for an already-resolved payment is a no-op.
 *     tags: [Payments]
 *     parameters:
 *       - in: header
 *         name: X-Razorpay-Signature
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [event, payload]
 *             properties:
 *               event: { type: string, example: payment.captured }
 *               payload: { type: object }
 *     responses:
 *       200:
 *         description: Event accepted (processed, or safely ignored — see description).
 *       401:
 *         description: Missing or invalid webhook signature.
 */
paymentsRouter.post('/webhook', validateRequest({ body: webhookEventSchema }), controller.webhook);

/**
 * @openapi
 * /api/v1/payments/order/{orderId}:
 *   get:
 *     summary: Get the payment relevant to an order
 *     description: Returns the SUCCESS payment if one exists, otherwise the most recent attempt. Ownership enforced the same way GET /orders/{id} enforces it — a student may only look up their own order's payment.
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { payment: { $ref: '#/components/schemas/Payment' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: A student requesting another student's order's payment.
 *       404:
 *         description: Order not found, or the order has no payment attempts.
 */
paymentsRouter.get(
  '/order/:orderId',
  authenticate(),
  validateRequest({ params: paymentOrderIdParamSchema }),
  controller.getByOrderId,
);

/**
 * @openapi
 * /api/v1/payments/{id}:
 *   get:
 *     summary: Get a payment by id
 *     description: A student may only view their own payments (403 otherwise). Kitchen staff/admin/super_admin may view any payment.
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { payment: { $ref: '#/components/schemas/Payment' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: A student requesting a payment that isn't theirs.
 *       404:
 *         description: Payment not found.
 */
paymentsRouter.get(
  '/:id',
  authenticate(),
  validateRequest({ params: paymentIdParamSchema }),
  controller.getById,
);
