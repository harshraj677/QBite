import { kitchenOrderIdParamSchema, listKitchenOrdersQuerySchema } from './kitchen.validation';

describe('kitchenOrderIdParamSchema', () => {
  it('accepts a valid ObjectId', () => {
    expect(kitchenOrderIdParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(
      true,
    );
  });

  it('rejects a malformed id', () => {
    expect(kitchenOrderIdParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });
});

describe('listKitchenOrdersQuerySchema', () => {
  it('applies defaults when no query params are given', () => {
    const result = listKitchenOrdersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 20, sortOrder: 'desc' });
    }
  });

  it('accepts every real order status as a filter', () => {
    for (const status of ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']) {
      expect(listKitchenOrdersQuerySchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('rejects an invalid status', () => {
    expect(listKitchenOrdersQuerySchema.safeParse({ status: 'shipped' }).success).toBe(false);
  });

  it('accepts a valid 6-digit pickupToken', () => {
    expect(listKitchenOrdersQuerySchema.safeParse({ pickupToken: '482913' }).success).toBe(true);
  });

  it('rejects a pickupToken that is not exactly 6 digits', () => {
    expect(listKitchenOrdersQuerySchema.safeParse({ pickupToken: '4829' }).success).toBe(false);
    expect(listKitchenOrdersQuerySchema.safeParse({ pickupToken: 'abcdef' }).success).toBe(false);
  });

  it('rejects a limit above the max page size', () => {
    expect(listKitchenOrdersQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });

  it('has no sortBy field — the dashboard only sorts by time', () => {
    const result = listKitchenOrdersQuerySchema.safeParse({ sortBy: 'totalAmount' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).sortBy).toBeUndefined();
    }
  });

  // Regression coverage for the Operations Center phase's new filters.
  it('accepts every real payment status as a filter', () => {
    for (const paymentStatus of ['pending', 'paid', 'failed', 'refunded']) {
      expect(listKitchenOrdersQuerySchema.safeParse({ paymentStatus }).success).toBe(true);
    }
  });

  it('rejects an invalid paymentStatus', () => {
    expect(listKitchenOrdersQuerySchema.safeParse({ paymentStatus: 'chargeback' }).success).toBe(
      false,
    );
  });

  // Regression coverage for the Payments Management phase's new filter.
  it('accepts every real payment method as a filter', () => {
    for (const paymentMethod of ['cash', 'online']) {
      expect(listKitchenOrdersQuerySchema.safeParse({ paymentMethod }).success).toBe(true);
    }
  });

  it('rejects an invalid paymentMethod', () => {
    expect(listKitchenOrdersQuerySchema.safeParse({ paymentMethod: 'crypto' }).success).toBe(false);
  });

  it('accepts valid studentId/canteenId ObjectIds', () => {
    const result = listKitchenOrdersQuerySchema.safeParse({
      studentId: '507f1f77bcf86cd799439011',
      canteenId: '507f1f77bcf86cd799439012',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed studentId/canteenId', () => {
    expect(listKitchenOrdersQuerySchema.safeParse({ studentId: 'nope' }).success).toBe(false);
    expect(listKitchenOrdersQuerySchema.safeParse({ canteenId: 'nope' }).success).toBe(false);
  });

  it('accepts a valid dateFrom/dateTo range', () => {
    const result = listKitchenOrdersQuerySchema.safeParse({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejects dateFrom after dateTo', () => {
    const result = listKitchenOrdersQuerySchema.safeParse({
      dateFrom: '2026-02-01',
      dateTo: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid minAmount/maxAmount range', () => {
    expect(
      listKitchenOrdersQuerySchema.safeParse({ minAmount: '500', maxAmount: '5000' }).success,
    ).toBe(true);
  });

  it('rejects minAmount above maxAmount', () => {
    expect(
      listKitchenOrdersQuerySchema.safeParse({ minAmount: '5000', maxAmount: '500' }).success,
    ).toBe(false);
  });

  it('rejects a negative amount bound', () => {
    expect(listKitchenOrdersQuerySchema.safeParse({ minAmount: '-100' }).success).toBe(false);
  });

  // Regression coverage for the Kitchen Operations Center phase.
  describe('includeItems', () => {
    it('defaults to false when omitted', () => {
      const result = listKitchenOrdersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.includeItems).toBe(false);
    });

    it('parses "true" as true', () => {
      const result = listKitchenOrdersQuerySchema.safeParse({ includeItems: 'true' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.includeItems).toBe(true);
    });

    // The exact bug z.coerce.boolean() would have: Boolean("false") is
    // true in plain JS, which would silently turn items on for a
    // request that explicitly asked for them to stay off.
    it('parses the literal string "false" as false, not true', () => {
      const result = listKitchenOrdersQuerySchema.safeParse({ includeItems: 'false' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.includeItems).toBe(false);
    });

    it('rejects a non-boolean-ish value', () => {
      expect(listKitchenOrdersQuerySchema.safeParse({ includeItems: 'yes' }).success).toBe(false);
    });
  });
});
