import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { OrderModel } from './order.model';
import { OrdersRepository } from './orders.repository';
import type { CreateOrderInput } from './orders.repository';

const repository = new OrdersRepository();
const canteenId = new Types.ObjectId();
const studentId = new Types.ObjectId();

function makeInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    _id: new Types.ObjectId(),
    orderNumber: `QB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    canteenId,
    studentId,
    paymentMethod: 'cash',
    subtotal: 3000,
    tax: 0,
    discount: 0,
    totalAmount: 3000,
    pickupToken: Math.floor(100000 + Math.random() * 900000).toString(),
    estimatedReadyTimeMinutes: 5,
    ...overrides,
  };
}

beforeAll(async () => {
  await connectTestDb();
  await OrderModel.init(); // see menu-categories.repository.test.ts for why this matters
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('OrdersRepository.create / findById', () => {
  it('creates an order with the pre-generated _id and expected defaults', async () => {
    const id = new Types.ObjectId();
    const created = await repository.create(makeInput({ _id: id }));

    expect(created._id.toString()).toBe(id.toString());
    expect(created.status).toBe('pending');
    expect(created.paymentStatus).toBe('pending');

    const found = await repository.findById(id);
    expect(found?.orderNumber).toBe(created.orderNumber);
  });

  it('rejects a duplicate orderNumber (unique index)', async () => {
    await repository.create(makeInput({ orderNumber: 'QB-DUPE01' }));

    await expect(repository.create(makeInput({ orderNumber: 'QB-DUPE01' }))).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('rejects a duplicate pickupToken (unique index)', async () => {
    await repository.create(makeInput({ pickupToken: '111111' }));

    await expect(repository.create(makeInput({ pickupToken: '111111' }))).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('returns null for a non-existent id', async () => {
    expect(await repository.findById(new Types.ObjectId())).toBeNull();
  });
});

describe('OrdersRepository.search / findByStudent / findByCanteen', () => {
  beforeEach(async () => {
    await repository.create(
      makeInput({ orderNumber: 'QB-AAAAAA', totalAmount: 1000, canteenId, studentId }),
    );
    await repository.create(
      makeInput({ orderNumber: 'QB-BBBBBB', totalAmount: 3000, canteenId, studentId }),
    );
    await repository.create(
      makeInput({
        orderNumber: 'QB-CCCCCC',
        totalAmount: 2000,
        canteenId: new Types.ObjectId(),
        studentId: new Types.ObjectId(),
      }),
    );
  });

  it('findByStudent scopes results to the given student', async () => {
    const result = await repository.findByStudent(studentId, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(2);
  });

  it('findByCanteen scopes results to the given canteen', async () => {
    const result = await repository.findByCanteen(canteenId, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(2);
  });

  it('filters by orderNumber', async () => {
    const result = await repository.search({
      orderNumber: 'QB-AAAAAA',
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(1);
  });

  // Regression coverage for the Kitchen Workflow phase — pickupToken
  // is a new filter on this shared search(), added for the kitchen
  // dashboard (OrdersService.searchOrders), and exercised here with no
  // studentId/canteenId at all, matching that unscoped-across-canteens
  // use case.
  it('filters by pickupToken with no studentId/canteenId scoping', async () => {
    const target = await repository.findByStudent(studentId, {
      orderNumber: 'QB-AAAAAA',
      page: 1,
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    const result = await repository.search({
      pickupToken: target.orders[0].pickupToken,
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(1);
    expect(result.orders[0].orderNumber).toBe('QB-AAAAAA');
  });

  it('filters by status', async () => {
    const all = await repository.findByStudent(studentId, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    await repository.updateStatus(all.orders[0]._id, 'pending', 'accepted');

    const result = await repository.search({
      studentId,
      status: 'accepted',
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(1);
  });

  it('sorts by totalAmount descending', async () => {
    const result = await repository.search({
      studentId,
      page: 1,
      limit: 10,
      sortBy: 'totalAmount',
      sortOrder: 'desc',
    });
    expect(result.orders.map((o) => o.totalAmount)).toEqual([3000, 1000]);
  });

  it('filters by date range', async () => {
    const future = new Date(Date.now() + 60_000);
    const result = await repository.search({
      studentId,
      dateFrom: future,
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(0);
  });

  it('paginates', async () => {
    const page1 = await repository.search({
      studentId,
      page: 1,
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(page1.orders).toHaveLength(1);
    expect(page1.total).toBe(2);
  });

  // Regression coverage for the Operations Center phase — paymentStatus/
  // minAmount/maxAmount are new filters on this shared search(), added
  // for the admin panel's unscoped orders control room (see
  // kitchen.validation.ts's doc comment).
  it('filters by paymentStatus', async () => {
    const all = await repository.findByStudent(studentId, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    await repository.updatePaymentStatus(all.orders[0]._id, 'paid');

    const result = await repository.search({
      studentId,
      paymentStatus: 'paid',
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(1);
  });

  // Regression coverage for the Payments Management phase.
  it('filters by paymentMethod', async () => {
    await repository.create(makeInput({ studentId, paymentMethod: 'online' }));

    const result = await repository.search({
      studentId,
      paymentMethod: 'online',
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(1);
    expect(result.orders[0].paymentMethod).toBe('online');
  });

  it('filters by minAmount/maxAmount, both inclusive', async () => {
    const result = await repository.search({
      studentId,
      minAmount: 1000,
      maxAmount: 1000,
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(1);
    expect(result.orders[0].totalAmount).toBe(1000);
  });

  it("combines paymentStatus, amount range, and date range with no studentId/canteenId scoping — the Operations Center's unscoped use case", async () => {
    const result = await repository.search({
      minAmount: 0,
      maxAmount: 5000,
      dateFrom: new Date(Date.now() - 60_000),
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(3);
  });
});

describe('OrdersRepository.updateStatus', () => {
  it('advances status and stamps the corresponding timestamp when fromStatus matches', async () => {
    const created = await repository.create(makeInput());

    const updated = await repository.updateStatus(created._id, 'pending', 'accepted');

    expect(updated?.status).toBe('accepted');
    expect(updated?.acceptedAt).toBeInstanceOf(Date);
  });

  it('returns null (no-op) when fromStatus does not match the current status', async () => {
    const created = await repository.create(makeInput());
    await repository.updateStatus(created._id, 'pending', 'accepted');

    // Current status is now 'accepted', not 'pending' — a second call
    // asserting the stale 'pending' precondition must not apply.
    const result = await repository.updateStatus(created._id, 'pending', 'accepted');

    expect(result).toBeNull();
  });

  it('returns null for a non-existent id', async () => {
    const result = await repository.updateStatus(new Types.ObjectId(), 'pending', 'accepted');
    expect(result).toBeNull();
  });
});

describe('OrdersRepository.cancelOrder', () => {
  it('cancels an order in a cancellable status', async () => {
    const created = await repository.create(makeInput());

    const cancelled = await repository.cancelOrder(created._id, 'Changed my mind');

    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
    expect(cancelled?.cancellationReason).toBe('Changed my mind');
  });

  it('returns null when the order is already completed (not cancellable)', async () => {
    const created = await repository.create(makeInput());
    await repository.updateStatus(created._id, 'pending', 'accepted');
    await repository.updateStatus(created._id, 'accepted', 'preparing');
    await repository.updateStatus(created._id, 'preparing', 'ready');
    await repository.updateStatus(created._id, 'ready', 'completed');

    const result = await repository.cancelOrder(created._id, 'too late');

    expect(result).toBeNull();
  });
});

// Regression coverage for the Payments phase's integration.
describe('OrdersRepository.updatePaymentStatus', () => {
  it('sets the order paymentStatus', async () => {
    const created = await repository.create(makeInput());
    expect(created.paymentStatus).toBe('pending');

    const updated = await repository.updatePaymentStatus(created._id, 'paid');

    expect(updated?.paymentStatus).toBe('paid');
  });

  it('does not touch the order status field', async () => {
    const created = await repository.create(makeInput());

    const updated = await repository.updatePaymentStatus(created._id, 'paid');

    expect(updated?.status).toBe('pending');
  });

  it('returns null for a non-existent id', async () => {
    const result = await repository.updatePaymentStatus(new Types.ObjectId(), 'paid');
    expect(result).toBeNull();
  });
});

// Regression coverage for the Analytics phase's aggregation methods.
describe('OrdersRepository analytics aggregations', () => {
  async function markPaid(id: Types.ObjectId): Promise<void> {
    await repository.updatePaymentStatus(id, 'paid');
  }

  describe('getStatusCounts', () => {
    it('zero-fills every status, not just ones with orders', async () => {
      const a = await repository.create(makeInput());
      await repository.updateStatus(a._id, 'pending', 'accepted');
      await repository.create(makeInput());

      const counts = await repository.getStatusCounts();

      expect(counts).toEqual({
        pending: 1,
        accepted: 1,
        preparing: 0,
        ready: 0,
        completed: 0,
        cancelled: 0,
      });
    });
  });

  describe('getRevenueSummary', () => {
    it('sums only paid orders within an unbounded (all-time) filter', async () => {
      const paid = await repository.create(makeInput({ totalAmount: 5000 }));
      await markPaid(paid._id);
      await repository.create(makeInput({ totalAmount: 9000 })); // stays pending — excluded

      const summary = await repository.getRevenueSummary({});

      expect(summary).toEqual({ revenue: 5000, orderCount: 1 });
    });

    it('respects a bounded date range that excludes the order', async () => {
      const order = await repository.create(makeInput({ totalAmount: 1000 }));
      await markPaid(order._id);

      // "now" (the order's real createdAt) falls outside this window.
      const summary = await repository.getRevenueSummary({
        from: new Date('2020-01-01'),
        to: new Date('2020-12-31'),
      });

      expect(summary).toEqual({ revenue: 0, orderCount: 0 });
    });

    it('returns zeroes when nothing matches', async () => {
      const summary = await repository.getRevenueSummary({});
      expect(summary).toEqual({ revenue: 0, orderCount: 0 });
    });
  });

  describe('getRevenueTimeSeries', () => {
    it('buckets paid revenue by day', async () => {
      const order = await repository.create(makeInput({ totalAmount: 2500 }));
      await markPaid(order._id);
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const series = await repository.getRevenueTimeSeries({ from, to, granularity: 'day' });

      expect(series).toHaveLength(1);
      expect(series[0]).toMatchObject({ revenue: 2500, orderCount: 1 });
    });
  });

  describe('getOrdersByDay / getOrdersByMonth', () => {
    it('counts every order regardless of status', async () => {
      await repository.create(makeInput());
      const cancelled = await repository.create(makeInput());
      await repository.cancelOrder(cancelled._id, 'test');
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const byDay = await repository.getOrdersByDay({ from, to });
      const byMonth = await repository.getOrdersByMonth({ from, to });

      expect(byDay.reduce((sum, row) => sum + row.count, 0)).toBe(2);
      expect(byMonth.reduce((sum, row) => sum + row.count, 0)).toBe(2);
    });
  });

  describe('getPeakOrderingHours', () => {
    it('groups by hour-of-day', async () => {
      await repository.create(makeInput());
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const hours = await repository.getPeakOrderingHours({ from, to });

      expect(hours.reduce((sum, row) => sum + row.count, 0)).toBe(1);
      expect(hours[0].hour).toBeGreaterThanOrEqual(0);
      expect(hours[0].hour).toBeLessThanOrEqual(23);
    });
  });

  describe('getAveragePreparationTimeMinutes', () => {
    it('averages readyAt - acceptedAt in minutes for orders that reached ready', async () => {
      const order = await repository.create(makeInput());
      await repository.updateStatus(order._id, 'pending', 'accepted');
      await OrderModel.updateOne(
        { _id: order._id },
        {
          $set: {
            acceptedAt: new Date('2026-01-01T10:00:00Z'),
            readyAt: new Date('2026-01-01T10:15:00Z'),
          },
        },
      );
      const from = new Date('2020-01-01');
      const to = new Date('2030-01-01');

      const avg = await repository.getAveragePreparationTimeMinutes({ from, to });

      expect(avg).toBe(15);
    });

    it('returns null when no order in range has both timestamps', async () => {
      await repository.create(makeInput());
      const avg = await repository.getAveragePreparationTimeMinutes({
        from: new Date(Date.now() - 60000),
        to: new Date(Date.now() + 60000),
      });
      expect(avg).toBeNull();
    });
  });

  describe('getStatusCounts with a date range', () => {
    it('scopes the breakdown to the given window — Order Analytics derives its completion rate from this same call', async () => {
      const completedOrder = await repository.create(makeInput());
      await repository.updateStatus(completedOrder._id, 'pending', 'accepted');
      await repository.updateStatus(completedOrder._id, 'accepted', 'preparing');
      await repository.updateStatus(completedOrder._id, 'preparing', 'ready');
      await repository.updateStatus(completedOrder._id, 'ready', 'completed');
      const cancelledOrder = await repository.create(makeInput());
      await repository.cancelOrder(cancelledOrder._id, 'test');
      await repository.create(makeInput()); // stays pending
      const from = new Date(Date.now() - 60000);
      const to = new Date(Date.now() + 60000);

      const counts = await repository.getStatusCounts({ from, to });

      expect(counts).toEqual({
        pending: 1,
        accepted: 0,
        preparing: 0,
        ready: 0,
        completed: 1,
        cancelled: 1,
      });
    });

    it('excludes orders outside the window', async () => {
      await repository.create(makeInput());

      const counts = await repository.getStatusCounts({
        from: new Date('2020-01-01'),
        to: new Date('2020-12-31'),
      });

      expect(counts.pending).toBe(0);
    });
  });

  describe('getRevenueByCanteen', () => {
    it('groups paid revenue by canteenId, sorted descending', async () => {
      const otherCanteenId = new Types.ObjectId();
      const a = await repository.create(makeInput({ totalAmount: 1000 }));
      await markPaid(a._id);
      const b = await repository.create(
        makeInput({ canteenId: otherCanteenId, totalAmount: 5000 }),
      );
      await markPaid(b._id);
      const from = new Date(Date.now() - 60000);
      const to = new Date(Date.now() + 60000);

      const rows = await repository.getRevenueByCanteen({ from, to });

      expect(rows[0]).toMatchObject({ canteenId: otherCanteenId, revenue: 5000, orderCount: 1 });
      expect(rows[1]).toMatchObject({ canteenId, revenue: 1000, orderCount: 1 });
    });
  });

  describe('getCustomerOrderStats', () => {
    it('counts every order but sums totalSpent from paid orders only', async () => {
      const paid = await repository.create(makeInput({ totalAmount: 4000 }));
      await markPaid(paid._id);
      await repository.create(makeInput({ totalAmount: 9000 })); // stays pending
      const from = new Date(Date.now() - 60000);
      const to = new Date(Date.now() + 60000);

      const rows = await repository.getCustomerOrderStats({ from, to });

      expect(rows).toEqual([{ studentId, orderCount: 2, totalSpent: 4000 }]);
    });
  });
});
