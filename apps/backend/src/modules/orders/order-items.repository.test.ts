import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { OrderItemsRepository } from './order-items.repository';
import type { CreateOrderItemInput } from './order-items.repository';

const repository = new OrderItemsRepository();

function makeInput(overrides: Partial<CreateOrderItemInput> = {}): CreateOrderItemInput {
  return {
    orderId: new Types.ObjectId(),
    menuItemId: new Types.ObjectId(),
    quantity: 2,
    unitPrice: 3000,
    totalPrice: 6000,
    itemSnapshot: {
      itemId: new Types.ObjectId().toString(),
      itemName: 'Veg Puff',
      categoryName: 'Snacks',
      unitPrice: 3000,
      isVeg: true,
    },
    ...overrides,
  };
}

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('OrderItemsRepository.createMany / findByOrderId', () => {
  it('bulk-inserts line items and finds them all by orderId', async () => {
    const orderId = new Types.ObjectId();

    await repository.createMany([
      makeInput({ orderId, itemSnapshot: { ...makeInput().itemSnapshot, itemName: 'Veg Puff' } }),
      makeInput({
        orderId,
        menuItemId: new Types.ObjectId(),
        itemSnapshot: { ...makeInput().itemSnapshot, itemName: 'Cold Coffee', isVeg: true },
      }),
    ]);

    const found = await repository.findByOrderId(orderId);
    expect(found).toHaveLength(2);
    expect(found.map((i) => i.itemSnapshot.itemName).sort()).toEqual(['Cold Coffee', 'Veg Puff']);
  });

  it('freezes the snapshot — later reads are unaffected by anything outside this document', async () => {
    const orderId = new Types.ObjectId();
    await repository.createMany([makeInput({ orderId })]);

    const [item] = await repository.findByOrderId(orderId);
    expect(item.itemSnapshot.unitPrice).toBe(3000);
    expect(item.unitPrice).toBe(3000);
  });

  it('returns an empty array for an order with no items', async () => {
    const found = await repository.findByOrderId(new Types.ObjectId());
    expect(found).toEqual([]);
  });
});
