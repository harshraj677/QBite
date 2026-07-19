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
});
