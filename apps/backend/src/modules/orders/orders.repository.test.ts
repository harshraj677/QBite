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
