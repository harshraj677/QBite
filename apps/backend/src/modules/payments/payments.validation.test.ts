import {
  createPaymentOrderSchema,
  paymentIdParamSchema,
  paymentOrderIdParamSchema,
  verifyPaymentSchema,
  webhookEventSchema,
} from './payments.validation';

const validId = '507f1f77bcf86cd799439011';

describe('createPaymentOrderSchema', () => {
  it('accepts a valid orderId', () => {
    expect(createPaymentOrderSchema.safeParse({ orderId: validId }).success).toBe(true);
  });

  it('rejects a malformed orderId', () => {
    expect(createPaymentOrderSchema.safeParse({ orderId: 'nope' }).success).toBe(false);
  });

  it('rejects a missing orderId', () => {
    expect(createPaymentOrderSchema.safeParse({}).success).toBe(false);
  });

  it('strips a client-supplied amount rather than rejecting the request', () => {
    const result = createPaymentOrderSchema.safeParse({ orderId: validId, amount: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).amount).toBeUndefined();
    }
  });
});

describe('verifyPaymentSchema', () => {
  const valid = {
    razorpayOrderId: 'order_ABC123',
    razorpayPaymentId: 'pay_XYZ789',
    razorpaySignature: 'a1b2c3',
  };

  it('accepts a complete valid payload', () => {
    expect(verifyPaymentSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a missing razorpayOrderId', () => {
    const { razorpayOrderId, ...rest } = valid;
    void razorpayOrderId;
    expect(verifyPaymentSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a missing razorpayPaymentId', () => {
    const { razorpayPaymentId, ...rest } = valid;
    void razorpayPaymentId;
    expect(verifyPaymentSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a missing razorpaySignature', () => {
    const { razorpaySignature, ...rest } = valid;
    void razorpaySignature;
    expect(verifyPaymentSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an empty string for any field', () => {
    expect(verifyPaymentSchema.safeParse({ ...valid, razorpaySignature: '' }).success).toBe(false);
  });

  it('has no orderId field — orderId is derived server-side from the Payment record', () => {
    const result = verifyPaymentSchema.safeParse({ ...valid, orderId: validId });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).orderId).toBeUndefined();
    }
  });
});

describe('paymentIdParamSchema / paymentOrderIdParamSchema', () => {
  it('accepts a valid ObjectId', () => {
    expect(paymentIdParamSchema.safeParse({ id: validId }).success).toBe(true);
    expect(paymentOrderIdParamSchema.safeParse({ orderId: validId }).success).toBe(true);
  });

  it('rejects a malformed id', () => {
    expect(paymentIdParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
    expect(paymentOrderIdParamSchema.safeParse({ orderId: 'nope' }).success).toBe(false);
  });
});

describe('webhookEventSchema', () => {
  it('accepts a minimal valid envelope', () => {
    expect(
      webhookEventSchema.safeParse({ event: 'payment.captured', payload: { payment: {} } }).success,
    ).toBe(true);
  });

  it('accepts an unrecognized event name — dispatch/ignoring happens in the service, not here', () => {
    expect(webhookEventSchema.safeParse({ event: 'some.future.event', payload: {} }).success).toBe(
      true,
    );
  });

  it('rejects a missing event field', () => {
    expect(webhookEventSchema.safeParse({ payload: {} }).success).toBe(false);
  });

  it('rejects a missing payload field', () => {
    expect(webhookEventSchema.safeParse({ event: 'payment.captured' }).success).toBe(false);
  });
});
