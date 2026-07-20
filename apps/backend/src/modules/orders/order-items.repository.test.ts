import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { OrderItemsRepository } from './order-items.repository';
import type { CreateOrderItemInput } from './order-items.repository';
import { OrdersRepository } from './orders.repository';
import type { CreateOrderInput } from './orders.repository';

const repository = new OrderItemsRepository();
const ordersRepository = new OrdersRepository();

function makeOrderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    _id: new Types.ObjectId(),
    orderNumber: `QB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    canteenId: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
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

// Regression coverage for the Kitchen Operations Center phase.
describe('OrderItemsRepository.findByOrderIds', () => {
  it('returns items across multiple orders in one query', async () => {
    const orderA = new Types.ObjectId();
    const orderB = new Types.ObjectId();
    const untouched = new Types.ObjectId();
    await repository.createMany([
      makeInput({ orderId: orderA }),
      makeInput({ orderId: orderB }),
      makeInput({ orderId: untouched }),
    ]);

    const found = await repository.findByOrderIds([orderA, orderB]);

    expect(found).toHaveLength(2);
    expect(found.map((i) => i.orderId.toString()).sort()).toEqual(
      [orderA.toString(), orderB.toString()].sort(),
    );
  });

  it('returns an empty array when given no ids', async () => {
    expect(await repository.findByOrderIds([])).toEqual([]);
  });
});

// Regression coverage for the Analytics phase's aggregation methods.
describe('OrderItemsRepository analytics aggregations', () => {
  const from = new Date(Date.now() - 60000);
  const to = new Date(Date.now() + 60000);

  describe('getItemSalesAggregate', () => {
    it('sums quantity/revenue per item across multiple orders', async () => {
      const orderA = await ordersRepository.create(makeOrderInput());
      const orderB = await ordersRepository.create(makeOrderInput());
      const itemId = new Types.ObjectId().toString();
      const snapshot = {
        itemId,
        itemName: 'Veg Puff',
        categoryName: 'Snacks',
        unitPrice: 3000,
        isVeg: true,
      };
      await repository.createMany([
        makeInput({ orderId: orderA._id, quantity: 2, totalPrice: 6000, itemSnapshot: snapshot }),
        makeInput({ orderId: orderB._id, quantity: 1, totalPrice: 3000, itemSnapshot: snapshot }),
      ]);

      const rows = await repository.getItemSalesAggregate({ from, to });

      expect(rows).toEqual([{ itemId, itemName: 'Veg Puff', quantitySold: 3, revenue: 9000 }]);
    });

    it('excludes items belonging to a cancelled order', async () => {
      const order = await ordersRepository.create(makeOrderInput());
      await ordersRepository.cancelOrder(order._id, 'test');
      await repository.createMany([makeInput({ orderId: order._id })]);

      const rows = await repository.getItemSalesAggregate({ from, to });

      expect(rows).toEqual([]);
    });

    it('sorts by quantitySold descending', async () => {
      const orderA = await ordersRepository.create(makeOrderInput());
      const orderB = await ordersRepository.create(makeOrderInput());
      await repository.createMany([
        makeInput({
          orderId: orderA._id,
          quantity: 1,
          itemSnapshot: { ...makeInput().itemSnapshot, itemId: 'low', itemName: 'Low' },
        }),
        makeInput({
          orderId: orderB._id,
          quantity: 5,
          itemSnapshot: { ...makeInput().itemSnapshot, itemId: 'high', itemName: 'High' },
        }),
      ]);

      const rows = await repository.getItemSalesAggregate({ from, to });

      expect(rows.map((r) => r.itemId)).toEqual(['high', 'low']);
    });
  });

  describe('getCategoryRevenueAggregate', () => {
    it('sums revenue per category, excluding cancelled orders', async () => {
      const activeOrder = await ordersRepository.create(makeOrderInput());
      const cancelledOrder = await ordersRepository.create(makeOrderInput());
      await ordersRepository.cancelOrder(cancelledOrder._id, 'test');
      await repository.createMany([
        makeInput({
          orderId: activeOrder._id,
          totalPrice: 4000,
          itemSnapshot: { ...makeInput().itemSnapshot, categoryName: 'Snacks' },
        }),
        makeInput({
          orderId: cancelledOrder._id,
          totalPrice: 9000,
          itemSnapshot: { ...makeInput().itemSnapshot, categoryName: 'Snacks' },
        }),
      ]);

      const rows = await repository.getCategoryRevenueAggregate({ from, to });

      expect(rows).toEqual([{ categoryName: 'Snacks', revenue: 4000, quantitySold: 2 }]);
    });
  });
});
