import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { PaymentModel } from './payment.model';
import { PaymentsRepository } from './payments.repository';
import type { CreatePaymentInput } from './payments.repository';

const repository = new PaymentsRepository();
const orderId = new Types.ObjectId();
const userId = new Types.ObjectId();

function makeInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    orderId,
    userId,
    razorpayOrderId: `order_${Math.random().toString(36).slice(2, 10)}`,
    amount: 24900,
    currency: 'INR',
    ...overrides,
  };
}

beforeAll(async () => {
  await connectTestDb();
  await PaymentModel.init(); // see menu-categories.repository.test.ts for why this matters
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('PaymentsRepository.create', () => {
  it('creates a payment with status defaulting to CREATED', async () => {
    const created = await repository.create(makeInput());
    expect(created.status).toBe('CREATED');
    expect(created.currency).toBe('INR');
  });
});

describe('PaymentsRepository.findById / findByOrderId', () => {
  it('finds by id', async () => {
    const created = await repository.create(makeInput());
    const found = await repository.findById(created._id);
    expect(found?.razorpayOrderId).toBe(created.razorpayOrderId);
  });

  it('returns every attempt for an order, most recent first', async () => {
    const first = await repository.create(makeInput());
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repository.create(makeInput());

    const result = await repository.findByOrderId(orderId);

    expect(result.map((p) => p._id.toString())).toEqual([
      second._id.toString(),
      first._id.toString(),
    ]);
  });

  it('returns an empty array for an order with no payment attempts', async () => {
    const result = await repository.findByOrderId(new Types.ObjectId());
    expect(result).toEqual([]);
  });
});

describe('PaymentsRepository.findRelevantByOrderId', () => {
  it('prefers the SUCCESS payment over more recent non-SUCCESS attempts', async () => {
    const success = await repository.create(makeInput());
    await repository.updateStatus(success._id, 'CREATED', 'SUCCESS', {
      razorpayPaymentId: 'pay_success',
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repository.create(makeInput()); // a later, still-CREATED attempt (shouldn't happen in practice once SUCCESS exists, but the query must still prefer SUCCESS)

    const result = await repository.findRelevantByOrderId(orderId);

    expect(result?.status).toBe('SUCCESS');
  });

  it('falls back to the most recent attempt when there is no SUCCESS yet', async () => {
    await repository.create(makeInput());
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repository.create(makeInput());

    const result = await repository.findRelevantByOrderId(orderId);

    expect(result?._id.toString()).toBe(second._id.toString());
  });

  it('returns null for an order with no payment attempts', async () => {
    const result = await repository.findRelevantByOrderId(new Types.ObjectId());
    expect(result).toBeNull();
  });
});

describe('PaymentsRepository.findByRazorpayOrderId / findByRazorpayPaymentId', () => {
  it('finds by razorpayOrderId', async () => {
    const created = await repository.create(makeInput({ razorpayOrderId: 'order_lookup_test' }));
    const found = await repository.findByRazorpayOrderId('order_lookup_test');
    expect(found?._id.toString()).toBe(created._id.toString());
  });

  it('finds by razorpayPaymentId once set', async () => {
    const created = await repository.create(makeInput());
    await repository.updateStatus(created._id, 'CREATED', 'SUCCESS', {
      razorpayPaymentId: 'pay_lookup_test',
    });

    const found = await repository.findByRazorpayPaymentId('pay_lookup_test');
    expect(found?._id.toString()).toBe(created._id.toString());
  });

  it('returns null when nothing matches', async () => {
    expect(await repository.findByRazorpayOrderId('nonexistent')).toBeNull();
    expect(await repository.findByRazorpayPaymentId('nonexistent')).toBeNull();
  });
});

describe('PaymentsRepository.existsSuccessForOrder', () => {
  it('returns false when no payment has succeeded', async () => {
    await repository.create(makeInput());
    expect(await repository.existsSuccessForOrder(orderId)).toBe(false);
  });

  it('returns true once a payment succeeds', async () => {
    const created = await repository.create(makeInput());
    await repository.updateStatus(created._id, 'CREATED', 'SUCCESS');

    expect(await repository.existsSuccessForOrder(orderId)).toBe(true);
  });
});

describe('PaymentsRepository.updateStatus', () => {
  it('advances status and applies extra fields atomically', async () => {
    const created = await repository.create(makeInput());

    const updated = await repository.updateStatus(created._id, 'CREATED', 'SUCCESS', {
      razorpayPaymentId: 'pay_abc',
      razorpaySignature: 'sig_abc',
    });

    expect(updated?.status).toBe('SUCCESS');
    expect(updated?.razorpayPaymentId).toBe('pay_abc');
  });

  it('returns null when fromStatus does not match the current status', async () => {
    const created = await repository.create(makeInput());
    await repository.updateStatus(created._id, 'CREATED', 'SUCCESS');

    // Current status is now SUCCESS, not CREATED — a second call
    // asserting the stale CREATED precondition must not apply.
    const result = await repository.updateStatus(created._id, 'CREATED', 'SUCCESS');

    expect(result).toBeNull();
  });

  it('returns null for a non-existent id', async () => {
    const result = await repository.updateStatus(new Types.ObjectId(), 'CREATED', 'SUCCESS');
    expect(result).toBeNull();
  });
});

// Regression coverage for "each order can have only one successful
// payment" — the model's partial unique index, not just a
// service-layer check.
describe('PaymentModel partial unique index on {orderId, status: SUCCESS}', () => {
  it('allows multiple non-SUCCESS payments for the same order', async () => {
    await repository.create(makeInput());
    await expect(repository.create(makeInput())).resolves.toBeDefined();
  });

  it('rejects a second SUCCESS payment for the same order at the database level', async () => {
    const first = await repository.create(makeInput());
    await repository.updateStatus(first._id, 'CREATED', 'SUCCESS');
    const second = await repository.create(makeInput());

    await expect(repository.updateStatus(second._id, 'CREATED', 'SUCCESS')).rejects.toMatchObject({
      code: 11000,
    });
  });
});
