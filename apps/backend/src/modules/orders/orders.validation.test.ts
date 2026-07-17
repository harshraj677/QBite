import {
  cancelOrderSchema,
  canteenIdParamSchema,
  createOrderSchema,
  listCanteenOrdersQuerySchema,
  listMyOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
} from './orders.validation';

const validMenuItemId = '507f1f77bcf86cd799439011';

describe('createOrderSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createOrderSchema.safeParse({
      items: [{ menuItemId: validMenuItemId, quantity: 2 }],
      paymentMethod: 'cash',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty items array', () => {
    const result = createOrderSchema.safeParse({ items: [], paymentMethod: 'cash' });
    expect(result.success).toBe(false);
  });

  it('rejects a zero or negative quantity', () => {
    expect(
      createOrderSchema.safeParse({
        items: [{ menuItemId: validMenuItemId, quantity: 0 }],
        paymentMethod: 'cash',
      }).success,
    ).toBe(false);
  });

  it('rejects an invalid paymentMethod', () => {
    const result = createOrderSchema.safeParse({
      items: [{ menuItemId: validMenuItemId, quantity: 1 }],
      paymentMethod: 'crypto',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed menuItemId', () => {
    const result = createOrderSchema.safeParse({
      items: [{ menuItemId: 'not-an-id', quantity: 1 }],
      paymentMethod: 'cash',
    });
    expect(result.success).toBe(false);
  });

  it('strips a client-supplied totalAmount rather than rejecting the request', () => {
    const result = createOrderSchema.safeParse({
      items: [{ menuItemId: validMenuItemId, quantity: 1 }],
      paymentMethod: 'cash',
      totalAmount: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).totalAmount).toBeUndefined();
    }
  });
});

describe('updateOrderStatusSchema', () => {
  it('accepts each updatable status', () => {
    for (const status of ['accepted', 'preparing', 'ready', 'completed']) {
      expect(updateOrderStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('rejects "pending" — not a valid target for this endpoint', () => {
    expect(updateOrderStatusSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('rejects "cancelled" — use the dedicated cancel endpoint instead', () => {
    expect(updateOrderStatusSchema.safeParse({ status: 'cancelled' }).success).toBe(false);
  });

  it('rejects a missing status', () => {
    expect(updateOrderStatusSchema.safeParse({}).success).toBe(false);
  });
});

describe('cancelOrderSchema', () => {
  it('accepts an omitted cancellationReason', () => {
    expect(cancelOrderSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid cancellationReason', () => {
    expect(cancelOrderSchema.safeParse({ cancellationReason: 'Changed my mind' }).success).toBe(
      true,
    );
  });

  it('rejects a too-short cancellationReason', () => {
    expect(cancelOrderSchema.safeParse({ cancellationReason: 'x' }).success).toBe(false);
  });
});

describe('orderIdParamSchema / canteenIdParamSchema', () => {
  it('accepts a valid ObjectId and rejects a malformed one', () => {
    expect(orderIdParamSchema.safeParse({ id: validMenuItemId }).success).toBe(true);
    expect(orderIdParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
    expect(canteenIdParamSchema.safeParse({ canteenId: validMenuItemId }).success).toBe(true);
    expect(canteenIdParamSchema.safeParse({ canteenId: 'nope' }).success).toBe(false);
  });
});

describe('listMyOrdersQuerySchema', () => {
  it('applies defaults', () => {
    const result = listMyOrdersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    }
  });

  it('coerces dateFrom/dateTo into Dates', () => {
    const result = listMyOrdersQuerySchema.safeParse({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateFrom).toBeInstanceOf(Date);
      expect(result.data.dateTo).toBeInstanceOf(Date);
    }
  });

  it('rejects an invalid status value', () => {
    const result = listMyOrdersQuerySchema.safeParse({ status: 'shipped' });
    expect(result.success).toBe(false);
  });

  it('rejects a limit above the max page size', () => {
    expect(listMyOrdersQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
});

describe('listCanteenOrdersQuerySchema', () => {
  it('accepts an optional studentId filter', () => {
    const result = listCanteenOrdersQuerySchema.safeParse({ studentId: validMenuItemId });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed studentId', () => {
    expect(listCanteenOrdersQuerySchema.safeParse({ studentId: 'nope' }).success).toBe(false);
  });
});
