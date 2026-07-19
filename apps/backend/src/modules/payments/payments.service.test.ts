import { Types } from 'mongoose';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '@errors/http-errors';
import type { AuditLogService } from '@modules/audit/audit-log.service';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import type { OrdersService } from '@modules/orders/orders.service';
import { PaymentsService } from './payments.service';
import type { PaymentsRepository } from './payments.repository';
import type { RazorpayClient } from './razorpay.client';
import type { IPayment } from './payment.types';
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay-signature.util';

jest.mock('./razorpay-signature.util', () => ({
  verifyPaymentSignature: jest.fn(),
  verifyWebhookSignature: jest.fn(),
}));

const mockVerifyPaymentSignature = verifyPaymentSignature as jest.Mock;
const mockVerifyWebhookSignature = verifyWebhookSignature as jest.Mock;

const orderId = new Types.ObjectId().toString();
const userId = new Types.ObjectId().toString();
const student = { id: userId, role: 'student' as const };
const otherStudent = { id: new Types.ObjectId().toString(), role: 'student' as const };
const admin = { id: new Types.ObjectId().toString(), role: 'admin' as const };
const meta = {};

function makePayment(overrides: Partial<IPayment> = {}): IPayment {
  return {
    _id: new Types.ObjectId(),
    orderId: new Types.ObjectId(orderId),
    userId: new Types.ObjectId(userId),
    razorpayOrderId: 'order_abc123',
    amount: 24900,
    currency: 'INR',
    status: 'CREATED',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IPayment;
}

function makeOrderDto(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    orderNumber: 'QB-2026-ABCD1234',
    canteenId: new Types.ObjectId().toString(),
    studentId: userId,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'online',
    subtotal: 24900,
    tax: 0,
    discount: 0,
    totalAmount: 24900,
    pickupToken: '123456',
    estimatedReadyTimeMinutes: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  } as unknown as Awaited<ReturnType<OrdersService['getOrderById']>>;
}

function makeMockPaymentsRepository(): jest.Mocked<PaymentsRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByOrderId: jest.fn(),
    findRelevantByOrderId: jest.fn(),
    findByRazorpayOrderId: jest.fn(),
    findByRazorpayPaymentId: jest.fn(),
    existsSuccessForOrder: jest.fn().mockResolvedValue(false),
    updateStatus: jest.fn(),
  } as unknown as jest.Mocked<PaymentsRepository>;
}

function makeMockOrdersService(): jest.Mocked<OrdersService> {
  return {
    getOrderById: jest.fn().mockResolvedValue(makeOrderDto()),
    updatePaymentStatus: jest.fn().mockResolvedValue(makeOrderDto()),
  } as unknown as jest.Mocked<OrdersService>;
}

function makeMockNotificationsService(): jest.Mocked<NotificationsService> {
  return {
    notifyOrderEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationsService>;
}

function makeMockAuditLogService(): jest.Mocked<AuditLogService> {
  return {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditLogService>;
}

function makeMockRazorpayClient(): jest.Mocked<RazorpayClient> {
  return {
    createOrder: jest.fn().mockResolvedValue({
      id: 'order_new123',
      amount: 24900,
      currency: 'INR',
      status: 'created',
    }),
  } as unknown as jest.Mocked<RazorpayClient>;
}

function makeService(
  overrides: {
    paymentsRepo?: jest.Mocked<PaymentsRepository>;
    ordersService?: jest.Mocked<OrdersService>;
    notificationsService?: jest.Mocked<NotificationsService>;
    auditLogService?: jest.Mocked<AuditLogService>;
    razorpayClient?: jest.Mocked<RazorpayClient>;
  } = {},
) {
  const paymentsRepo = overrides.paymentsRepo ?? makeMockPaymentsRepository();
  const ordersService = overrides.ordersService ?? makeMockOrdersService();
  const notificationsService = overrides.notificationsService ?? makeMockNotificationsService();
  const auditLogService = overrides.auditLogService ?? makeMockAuditLogService();
  const razorpayClient = overrides.razorpayClient ?? makeMockRazorpayClient();
  return {
    service: new PaymentsService(
      paymentsRepo,
      ordersService,
      notificationsService,
      auditLogService,
      razorpayClient,
    ),
    paymentsRepo,
    ordersService,
    notificationsService,
    auditLogService,
    razorpayClient,
  };
}

beforeEach(() => {
  mockVerifyPaymentSignature.mockReset();
  mockVerifyWebhookSignature.mockReset();
});

describe('PaymentsService.createPaymentOrder', () => {
  it('creates a Razorpay order using the server-computed order total, never a client-supplied amount', async () => {
    const { service, paymentsRepo, razorpayClient, auditLogService } = makeService();
    paymentsRepo.create.mockResolvedValue(makePayment());

    await service.createPaymentOrder(orderId, student, meta);

    expect(razorpayClient.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 24900, currency: 'INR' }),
    );
    expect(paymentsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId, userId: student.id, amount: 24900 }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.created', success: true }),
    );
  });

  it('reuses OrdersService.getOrderById, so a non-owning student is rejected the same way Orders itself rejects it', async () => {
    const { service, ordersService, razorpayClient } = makeService();
    ordersService.getOrderById.mockRejectedValue(
      new ForbiddenError('ORDER_ACCESS_DENIED', 'You do not have access to this order.'),
    );

    await expect(service.createPaymentOrder(orderId, otherStudent, meta)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(razorpayClient.createOrder).not.toHaveBeenCalled();
  });

  it('throws ConflictError when the order is already marked paid', async () => {
    const { service, ordersService, razorpayClient } = makeService();
    ordersService.getOrderById.mockResolvedValue(makeOrderDto({ paymentStatus: 'paid' }));

    await expect(service.createPaymentOrder(orderId, student, meta)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(razorpayClient.createOrder).not.toHaveBeenCalled();
  });

  it('throws ConflictError when a SUCCESS payment already exists, even if Order.paymentStatus has not caught up yet', async () => {
    const { service, paymentsRepo, razorpayClient } = makeService();
    paymentsRepo.existsSuccessForOrder.mockResolvedValue(true);

    await expect(service.createPaymentOrder(orderId, student, meta)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(razorpayClient.createOrder).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.verifyPayment', () => {
  const verifyInput = {
    razorpayOrderId: 'order_abc123',
    razorpayPaymentId: 'pay_xyz789',
    razorpaySignature: 'sig_abc',
  };

  it('throws NotFoundError when no payment matches the given razorpayOrderId', async () => {
    const { service, paymentsRepo } = makeService();
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(null);

    await expect(service.verifyPayment(verifyInput, student, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('throws ForbiddenError when the payment belongs to a different user', async () => {
    const { service, paymentsRepo } = makeService();
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(makePayment());

    await expect(service.verifyPayment(verifyInput, otherStudent, meta)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('is idempotent: a payment already SUCCESS is returned as-is without re-verifying the signature', async () => {
    const { service, paymentsRepo, paymentsRepo: repo } = makeService();
    const payment = makePayment({ status: 'SUCCESS' });
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(payment);

    const result = await service.verifyPayment(verifyInput, student, meta);

    expect(result.status).toBe('SUCCESS');
    expect(mockVerifyPaymentSignature).not.toHaveBeenCalled();
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('is idempotent: a payment already FAILED is returned as-is without re-verifying the signature', async () => {
    const { service, paymentsRepo } = makeService();
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(makePayment({ status: 'FAILED' }));

    const result = await service.verifyPayment(verifyInput, student, meta);

    expect(result.status).toBe('FAILED');
    expect(mockVerifyPaymentSignature).not.toHaveBeenCalled();
  });

  it('on a valid signature: transitions to SUCCESS, marks the order paid, and notifies payment_success', async () => {
    const { service, paymentsRepo, ordersService, notificationsService, auditLogService } =
      makeService();
    const payment = makePayment();
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(payment);
    paymentsRepo.updateStatus.mockResolvedValue(
      makePayment({ status: 'SUCCESS', razorpayPaymentId: verifyInput.razorpayPaymentId }),
    );
    mockVerifyPaymentSignature.mockReturnValue(true);

    const result = await service.verifyPayment(verifyInput, student, meta);

    expect(result.status).toBe('SUCCESS');
    expect(paymentsRepo.updateStatus).toHaveBeenCalledWith(
      payment._id,
      'CREATED',
      'SUCCESS',
      expect.objectContaining({ razorpayPaymentId: verifyInput.razorpayPaymentId }),
    );
    expect(ordersService.updatePaymentStatus).toHaveBeenCalledWith(orderId, 'paid');
    expect(notificationsService.notifyOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'payment_success', amount: payment.amount }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.success', success: true }),
    );
  });

  it('on an invalid signature: transitions to FAILED, notifies payment_failed, leaves the order untouched, and throws', async () => {
    const { service, paymentsRepo, ordersService, notificationsService } = makeService();
    const payment = makePayment();
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(payment);
    paymentsRepo.updateStatus.mockResolvedValue(
      makePayment({ status: 'FAILED', failureReason: 'Signature verification failed' }),
    );
    mockVerifyPaymentSignature.mockReturnValue(false);

    await expect(service.verifyPayment(verifyInput, student, meta)).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );

    expect(paymentsRepo.updateStatus).toHaveBeenCalledWith(
      payment._id,
      'CREATED',
      'FAILED',
      expect.objectContaining({ failureReason: 'Signature verification failed' }),
    );
    expect(ordersService.updatePaymentStatus).not.toHaveBeenCalled();
    expect(notificationsService.notifyOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'payment_failed' }),
    );
  });
});

describe('PaymentsService.getPaymentById', () => {
  it('returns the payment for its owning student', async () => {
    const { service, paymentsRepo } = makeService();
    paymentsRepo.findById.mockResolvedValue(makePayment());

    const result = await service.getPaymentById('id', student);

    expect(result.userId).toBe(userId);
  });

  it('allows staff/admin to view any payment', async () => {
    const { service, paymentsRepo } = makeService();
    paymentsRepo.findById.mockResolvedValue(makePayment());

    await expect(service.getPaymentById('id', admin)).resolves.toBeDefined();
  });

  it('throws ForbiddenError when a student requests a payment that is not theirs', async () => {
    const { service, paymentsRepo } = makeService();
    paymentsRepo.findById.mockResolvedValue(makePayment());

    await expect(service.getPaymentById('id', otherStudent)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws NotFoundError when no payment matches', async () => {
    const { service, paymentsRepo } = makeService();
    paymentsRepo.findById.mockResolvedValue(null);

    await expect(service.getPaymentById('id', student)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('PaymentsService.getPaymentByOrderId', () => {
  it('reuses OrdersService.getOrderById for ownership, then returns the relevant payment', async () => {
    const { service, ordersService, paymentsRepo } = makeService();
    paymentsRepo.findRelevantByOrderId.mockResolvedValue(makePayment());

    const result = await service.getPaymentByOrderId(orderId, student);

    expect(ordersService.getOrderById).toHaveBeenCalledWith(orderId, student);
    expect(result.orderId).toBe(orderId);
  });

  it('throws NotFoundError when the order has no payment attempts', async () => {
    const { service, paymentsRepo } = makeService();
    paymentsRepo.findRelevantByOrderId.mockResolvedValue(null);

    await expect(service.getPaymentByOrderId(orderId, student)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('PaymentsService.handleWebhookEvent', () => {
  const rawBody = Buffer.from('{}');

  it('throws UnauthorizedError when the signature header is missing', async () => {
    const { service } = makeService();

    await expect(
      service.handleWebhookEvent({ event: 'payment.captured', payload: {} }, rawBody, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockVerifyWebhookSignature).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when the signature is invalid', async () => {
    const { service } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(false);

    await expect(
      service.handleWebhookEvent({ event: 'payment.captured', payload: {} }, rawBody, 'bad-sig'),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('ignores an unrecognized event type without throwing', async () => {
    const { service, paymentsRepo } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(true);

    await service.handleWebhookEvent({ event: 'order.paid', payload: {} }, rawBody, 'sig');

    expect(paymentsRepo.findByRazorpayOrderId).not.toHaveBeenCalled();
  });

  it('ignores payment.captured safely when the payload is missing the expected entity shape', async () => {
    const { service, paymentsRepo } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(true);

    await service.handleWebhookEvent({ event: 'payment.captured', payload: {} }, rawBody, 'sig');

    expect(paymentsRepo.findByRazorpayOrderId).not.toHaveBeenCalled();
  });

  it('ignores payment.captured safely when no payment matches the Razorpay order id', async () => {
    const { service, paymentsRepo } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(true);
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(null);

    await service.handleWebhookEvent(
      {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_1', order_id: 'order_unknown' } } },
      },
      rawBody,
      'sig',
    );

    expect(paymentsRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('payment.captured transitions a matched payment to SUCCESS and marks the order paid', async () => {
    const { service, paymentsRepo, ordersService, notificationsService } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(true);
    const payment = makePayment();
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(payment);
    paymentsRepo.updateStatus.mockResolvedValue(
      makePayment({ status: 'SUCCESS', razorpayPaymentId: 'pay_1' }),
    );

    await service.handleWebhookEvent(
      {
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_1', order_id: payment.razorpayOrderId, method: 'upi' } },
        },
      },
      rawBody,
      'sig',
    );

    expect(paymentsRepo.updateStatus).toHaveBeenCalledWith(
      payment._id,
      'CREATED',
      'SUCCESS',
      expect.objectContaining({ razorpayPaymentId: 'pay_1', paymentMethod: 'upi' }),
    );
    expect(ordersService.updatePaymentStatus).toHaveBeenCalledWith(orderId, 'paid');
    expect(notificationsService.notifyOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'payment_success' }),
    );
  });

  it('payment.failed transitions a matched payment to FAILED without touching the order', async () => {
    const { service, paymentsRepo, ordersService } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(true);
    const payment = makePayment();
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(payment);
    paymentsRepo.updateStatus.mockResolvedValue(
      makePayment({ status: 'FAILED', failureReason: 'Insufficient funds' }),
    );

    await service.handleWebhookEvent(
      {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_1',
              order_id: payment.razorpayOrderId,
              error_description: 'Insufficient funds',
            },
          },
        },
      },
      rawBody,
      'sig',
    );

    expect(paymentsRepo.updateStatus).toHaveBeenCalledWith(
      payment._id,
      'CREATED',
      'FAILED',
      expect.objectContaining({ failureReason: 'Insufficient funds' }),
    );
    expect(ordersService.updatePaymentStatus).not.toHaveBeenCalled();
  });

  it('refund.processed looks the payment up by razorpayPaymentId (not order id) and transitions to REFUNDED', async () => {
    const { service, paymentsRepo, ordersService, notificationsService } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(true);
    const payment = makePayment({ status: 'SUCCESS', razorpayPaymentId: 'pay_1' });
    paymentsRepo.findByRazorpayPaymentId.mockResolvedValue(payment);
    paymentsRepo.updateStatus.mockResolvedValue(
      makePayment({ status: 'REFUNDED', refundedAmount: 24900 }),
    );

    await service.handleWebhookEvent(
      {
        event: 'refund.processed',
        payload: { refund: { entity: { payment_id: 'pay_1', amount: 24900 } } },
      },
      rawBody,
      'sig',
    );

    expect(paymentsRepo.findByRazorpayPaymentId).toHaveBeenCalledWith('pay_1');
    expect(paymentsRepo.updateStatus).toHaveBeenCalledWith(
      payment._id,
      'SUCCESS',
      'REFUNDED',
      expect.objectContaining({ refundedAmount: 24900 }),
    );
    expect(ordersService.updatePaymentStatus).toHaveBeenCalledWith(orderId, 'refunded');
    expect(notificationsService.notifyOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'payment_refunded', amount: 24900 }),
    );
  });

  it('is idempotent: a payment.captured retry for an already-SUCCESS payment does not re-audit or re-notify', async () => {
    const { service, paymentsRepo, notificationsService, auditLogService } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(true);
    const payment = makePayment({ status: 'SUCCESS', razorpayPaymentId: 'pay_1' });
    paymentsRepo.findByRazorpayOrderId.mockResolvedValue(payment);

    await service.handleWebhookEvent(
      {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_1', order_id: payment.razorpayOrderId } } },
      },
      rawBody,
      'sig',
    );

    expect(paymentsRepo.updateStatus).not.toHaveBeenCalled();
    expect(notificationsService.notifyOrderEvent).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it('swallows an unexpected processing error rather than throwing, so a signature-valid webhook always resolves', async () => {
    const { service, paymentsRepo } = makeService();
    mockVerifyWebhookSignature.mockReturnValue(true);
    paymentsRepo.findByRazorpayOrderId.mockRejectedValue(new Error('DB unavailable'));

    await expect(
      service.handleWebhookEvent(
        {
          event: 'payment.captured',
          payload: { payment: { entity: { id: 'pay_1', order_id: 'order_abc123' } } },
        },
        rawBody,
        'sig',
      ),
    ).resolves.toBeUndefined();
  });
});
