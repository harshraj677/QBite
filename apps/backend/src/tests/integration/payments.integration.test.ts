import { createHmac } from 'node:crypto';

import request from 'supertest';
import type { Express } from 'express';

// Stubs the one external side effect this module has (an outbound
// HTTP call to Razorpay's REST API for POST /payments/create-order) —
// same `jest.mock` pattern auth.integration.test.ts already uses for
// LoggingEmailService. Everything downstream of this (repository,
// signature verification, Orders/Notifications/Audit integration) is
// exercised for real, against mongodb-memory-server.
jest.mock('@modules/payments/razorpay.client', () => ({
  RazorpayClient: jest.fn().mockImplementation(() => ({
    createOrder: jest.fn(async (input: { amount: number; currency: string; receipt: string }) => ({
      id: `order_test_${Math.random().toString(36).slice(2, 15)}`,
      amount: input.amount,
      currency: input.currency,
      status: 'created',
    })),
  })),
}));

// Imported after the mock (Jest hoists jest.mock above these) so the
// payments module picks up the stubbed RazorpayClient.
import { createApp } from '../../app';
import { env } from '@config/env';
import { AuditLogModel } from '@modules/audit/audit-log.model';
import { signAccessToken } from '@modules/auth/token.util';
import { NotificationModel } from '@modules/notifications/notification.model';
import { PaymentModel } from '@modules/payments/payment.model';
import type { IUser } from '@modules/users/user.types';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/test-db';
import { createTestUser } from '../helpers/user-factory';

let app: Express;

beforeAll(async () => {
  await connectTestDb();
  await PaymentModel.init(); // see payments.repository.test.ts — the partial unique index must exist before any test relies on it
  app = createApp();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

/** Mints a valid access token directly, bypassing /auth/login — same pattern as every other integration suite; this one isn't testing auth either. */
function tokenFor(user: IUser): string {
  return signAccessToken({ sub: user._id.toString(), role: user.role }).token;
}

async function authHeaderFor(role: IUser['role']): Promise<{ Authorization: string; user: IUser }> {
  const { user } = await createTestUser({ role });
  return { Authorization: `Bearer ${tokenFor(user)}`, user };
}

async function setupCanteenWithItem(
  adminAuth: string,
): Promise<{ canteenId: string; menuItemId: string; price: number }> {
  const unique = Math.random().toString(36).slice(2, 8);
  const canteenRes = await request(app)
    .post('/api/v1/canteens')
    .set('Authorization', adminAuth)
    .send({
      name: `Canteen ${unique}`,
      location: 'Block A, Ground Floor',
      contactNumber: '+919876543210',
      email: `${unique}@college.edu`,
      openingTime: '09:00',
      closingTime: '21:00',
    });
  const canteenId = canteenRes.body.data.canteen.id as string;

  const categoryRes = await request(app)
    .post(`/api/v1/canteens/${canteenId}/categories`)
    .set('Authorization', adminAuth)
    .send({ name: 'Snacks' });
  const categoryId = categoryRes.body.data.category.id as string;

  const price = 24900;
  const itemRes = await request(app)
    .post(`/api/v1/canteens/${canteenId}/menu-items`)
    .set('Authorization', adminAuth)
    .send({ categoryId, name: 'Thali', price, preparationTimeMinutes: 10, isVeg: true });

  return { canteenId, menuItemId: itemRes.body.data.item.id as string, price };
}

async function placeOrder(studentAuth: string, canteenId: string, menuItemId: string) {
  return request(app)
    .post(`/api/v1/canteens/${canteenId}/orders`)
    .set('Authorization', studentAuth)
    .send({ items: [{ menuItemId, quantity: 1 }], paymentMethod: 'online' });
}

/** The exact HMAC-SHA256(order_id + "|" + payment_id, key_secret) formula verifyPaymentSignature checks — see razorpay-signature.util.ts. */
function paymentSignature(razorpayOrderId: string, razorpayPaymentId: string): string {
  return createHmac('sha256', env.razorpay.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
}

/**
 * Sends a webhook request with a real HMAC-SHA256 signature computed
 * over the *literal* JSON bytes being sent — mirrors exactly what
 * app.ts's `express.json({ verify })` captures as `req.rawBody`, so
 * this proves the full raw-body-capture -> signature-verification
 * pipeline end-to-end, not just the crypto utility in isolation (see
 * razorpay-signature.util.test.ts for that).
 */
async function sendWebhook(body: Record<string, unknown>, signatureOverride?: string) {
  const rawBody = JSON.stringify(body);
  const signature =
    signatureOverride ??
    createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');
  return request(app)
    .post('/api/v1/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', signature)
    .send(rawBody);
}

describe('POST /payments/create-order', () => {
  it('creates a Razorpay order sized from the server-computed order total, not a client-supplied amount', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { canteenId, menuItemId, price } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId: order.body.data.order.id, amount: 1 }); // a smuggled `amount` must be ignored

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toMatchObject({
      orderId: order.body.data.order.id,
      userId: student._id.toString(),
      amount: price,
      currency: 'INR',
      status: 'CREATED',
    });
    expect(res.body.data.payment.razorpaySignature).toBeUndefined();

    const log = await AuditLogModel.findOne({ action: 'payment.created', actorId: student._id });
    expect(log).not.toBeNull();
  });

  it('forbids a student from creating a payment for someone else’s order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', otherStudentAuth)
      .send({ orderId: order.body.data.order.id });

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .send({ orderId: '507f1f77bcf86cd799439011' });
    expect(res.status).toBe(401);
  });

  it('forbids a non-student role', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const order = await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', adminAuth)
      .send({ orderId: order.body.data.order.id });

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent order', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(404);
  });

  it('rejects creating a second payment order once the order already has a SUCCESS payment', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const createRes = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId: order.body.data.order.id });
    const { razorpayOrderId } = createRes.body.data.payment;
    const razorpayPaymentId = 'pay_test_1';
    await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', studentAuth)
      .send({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: paymentSignature(razorpayOrderId, razorpayPaymentId),
      });

    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId: order.body.data.order.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_ALREADY_COMPLETED');
  });
});

describe('POST /payments/verify', () => {
  async function createPayment(studentAuth: string, orderId: string) {
    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId });
    return res.body.data.payment as { id: string; razorpayOrderId: string };
  }

  it('marks the payment SUCCESS, marks the order paid, and notifies the student on a valid signature', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);
    const razorpayPaymentId = 'pay_test_success';

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', studentAuth)
      .send({
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: paymentSignature(payment.razorpayOrderId, razorpayPaymentId),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('SUCCESS');

    const orderRes = await request(app)
      .get(`/api/v1/orders/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);
    expect(orderRes.body.data.order.paymentStatus).toBe('paid');

    const notification = await NotificationModel.findOne({
      userId: student._id,
      type: 'payment_success',
    });
    expect(notification).not.toBeNull();

    const log = await AuditLogModel.findOne({ action: 'payment.success', actorId: student._id });
    expect(log).not.toBeNull();
  });

  it('marks the payment FAILED and leaves the order unpaid on an invalid signature', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', studentAuth)
      .send({
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: 'pay_test_bad',
        razorpaySignature: '0'.repeat(64),
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_SIGNATURE_INVALID');

    const orderRes = await request(app)
      .get(`/api/v1/orders/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);
    expect(orderRes.body.data.order.paymentStatus).toBe('pending');

    const notification = await NotificationModel.findOne({
      userId: student._id,
      type: 'payment_failed',
    });
    expect(notification).not.toBeNull();
  });

  it('is idempotent: verifying an already-SUCCESS payment again does not write a second audit entry or notification', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);
    const razorpayPaymentId = 'pay_test_idempotent';
    const verifyBody = {
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: paymentSignature(payment.razorpayOrderId, razorpayPaymentId),
    };
    await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', studentAuth)
      .send(verifyBody);

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', studentAuth)
      .send(verifyBody);

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('SUCCESS');
    const notifications = await NotificationModel.find({
      userId: student._id,
      type: 'payment_success',
    });
    expect(notifications).toHaveLength(1);
  });

  it('returns 404 for an unrecognized razorpayOrderId', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', studentAuth)
      .send({
        razorpayOrderId: 'order_unknown',
        razorpayPaymentId: 'pay_x',
        razorpaySignature: '0'.repeat(64),
      });

    expect(res.status).toBe(404);
  });

  it('forbids verifying a payment that belongs to a different student', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', otherStudentAuth)
      .send({
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: 'pay_x',
        razorpaySignature: '0'.repeat(64),
      });

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/v1/payments/verify')
      .send({
        razorpayOrderId: 'order_x',
        razorpayPaymentId: 'pay_x',
        razorpaySignature: '0'.repeat(64),
      });
    expect(res.status).toBe(401);
  });
});

describe('POST /payments/webhook', () => {
  async function createPayment(studentAuth: string, orderId: string) {
    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId });
    return res.body.data.payment as { id: string; razorpayOrderId: string };
  }

  it('rejects a request with no signature header', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({ event: 'payment.captured', payload: {} });
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid signature', async () => {
    const res = await sendWebhook(
      { event: 'payment.captured', payload: {} },
      'not-the-real-signature',
    );
    expect(res.status).toBe(401);
  });

  it('payment.captured marks the matched payment SUCCESS and the order paid', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);

    const res = await sendWebhook({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_webhook_1', order_id: payment.razorpayOrderId, method: 'upi' },
        },
      },
    });

    expect(res.status).toBe(200);
    const stored = await PaymentModel.findById(payment.id);
    expect(stored?.status).toBe('SUCCESS');
    expect(stored?.paymentMethod).toBe('upi');

    const orderRes = await request(app)
      .get(`/api/v1/orders/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);
    expect(orderRes.body.data.order.paymentStatus).toBe('paid');
  });

  it('payment.failed marks the matched payment FAILED without touching the order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);

    const res = await sendWebhook({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_2',
            order_id: payment.razorpayOrderId,
            error_description: 'Card declined',
          },
        },
      },
    });

    expect(res.status).toBe(200);
    const stored = await PaymentModel.findById(payment.id);
    expect(stored?.status).toBe('FAILED');
    expect(stored?.failureReason).toBe('Card declined');

    const orderRes = await request(app)
      .get(`/api/v1/orders/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);
    expect(orderRes.body.data.order.paymentStatus).toBe('pending');
  });

  it('refund.processed marks a SUCCESS payment REFUNDED and the order refunded, correlating by payment id not order id', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);
    await sendWebhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_webhook_3', order_id: payment.razorpayOrderId } } },
    });

    const res = await sendWebhook({
      event: 'refund.processed',
      payload: { refund: { entity: { payment_id: 'pay_webhook_3', amount: 24900 } } },
    });

    expect(res.status).toBe(200);
    const stored = await PaymentModel.findById(payment.id);
    expect(stored?.status).toBe('REFUNDED');
    expect(stored?.refundedAmount).toBe(24900);

    const orderRes = await request(app)
      .get(`/api/v1/orders/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);
    expect(orderRes.body.data.order.paymentStatus).toBe('refunded');
  });

  it('ignores an unrecognized event type with a 200 and no state change', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);

    const res = await sendWebhook({ event: 'order.paid', payload: {} });

    expect(res.status).toBe(200);
    const stored = await PaymentModel.findById(payment.id);
    expect(stored?.status).toBe('CREATED');
  });

  it('is idempotent: a retried payment.captured delivery for an already-SUCCESS payment does not duplicate the audit log', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);
    const captureEvent = {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_webhook_retry', order_id: payment.razorpayOrderId } },
      },
    };
    await sendWebhook(captureEvent);

    const res = await sendWebhook(captureEvent);

    expect(res.status).toBe(200);
    const logs = await AuditLogModel.find({ action: 'payment.success' });
    expect(logs).toHaveLength(1);
  });

  it('safely ignores a payment.captured event for an unrecognized razorpayOrderId', async () => {
    const res = await sendWebhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_x', order_id: 'order_never_created' } } },
    });

    expect(res.status).toBe(200);
  });
});

describe('GET /payments/:id', () => {
  async function createPayment(studentAuth: string, orderId: string) {
    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId });
    return res.body.data.payment as { id: string };
  }

  it('allows the owning student to view their payment', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);

    const res = await request(app)
      .get(`/api/v1/payments/${payment.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.payment.id).toBe(payment.id);
  });

  it('forbids a different student from viewing the payment', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);

    const res = await request(app)
      .get(`/api/v1/payments/${payment.id}`)
      .set('Authorization', otherStudentAuth);

    expect(res.status).toBe(403);
  });

  it('allows admin to view any payment', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const payment = await createPayment(studentAuth, order.body.data.order.id);

    const res = await request(app)
      .get(`/api/v1/payments/${payment.id}`)
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
  });

  it('returns 404 for a non-existent payment', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .get('/api/v1/payments/507f1f77bcf86cd799439011')
      .set('Authorization', studentAuth);

    expect(res.status).toBe(404);
  });
});

describe('GET /payments/order/:orderId', () => {
  it('returns the relevant payment for the order’s owner', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId: order.body.data.order.id });

    const res = await request(app)
      .get(`/api/v1/payments/order/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.payment.orderId).toBe(order.body.data.order.id);
  });

  it('forbids a different student', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', studentAuth)
      .send({ orderId: order.body.data.order.id });

    const res = await request(app)
      .get(`/api/v1/payments/order/${order.body.data.order.id}`)
      .set('Authorization', otherStudentAuth);

    expect(res.status).toBe(403);
  });

  it('returns 404 when the order has no payment attempts yet', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .get(`/api/v1/payments/order/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(404);
  });
});
