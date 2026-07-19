import { Types } from 'mongoose';

import type { OrdersService } from '@modules/orders/orders.service';
import { KitchenService } from './kitchen.service';

const actor = { id: new Types.ObjectId().toString(), role: 'kitchen_staff' as const };
const meta = {};

function makeMockOrdersService(): jest.Mocked<OrdersService> {
  return {
    searchOrders: jest.fn(),
    getOrderById: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as jest.Mocked<OrdersService>;
}

function makeService(overrides: { ordersService?: jest.Mocked<OrdersService> } = {}) {
  const ordersService = overrides.ordersService ?? makeMockOrdersService();
  return { service: new KitchenService(ordersService), ordersService };
}

const defaultQuery = { page: 1, limit: 20, sortOrder: 'desc' as const };

describe('KitchenService.listOrders', () => {
  it('delegates to OrdersService.searchOrders, always sorting by createdAt', async () => {
    const { service, ordersService } = makeService();
    ordersService.searchOrders.mockResolvedValue({ orders: [], total: 0 });

    await service.listOrders({ ...defaultQuery, status: 'pending', pickupToken: '482913' });

    expect(ordersService.searchOrders).toHaveBeenCalledWith({
      status: 'pending',
      orderNumber: undefined,
      pickupToken: '482913',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });
});

describe('KitchenService.getOrder', () => {
  it('delegates to OrdersService.getOrderById unchanged', async () => {
    const { service, ordersService } = makeService();
    ordersService.getOrderById.mockResolvedValue({ id: 'order-1' } as never);

    const result = await service.getOrder('order-1', actor);

    expect(ordersService.getOrderById).toHaveBeenCalledWith('order-1', actor);
    expect(result).toEqual({ id: 'order-1' });
  });
});

describe.each([
  ['acceptOrder', 'accepted'],
  ['startPreparing', 'preparing'],
  ['markReady', 'ready'],
  ['completePickup', 'completed'],
] as const)('KitchenService.%s', (method, expectedStatus) => {
  it(`calls OrdersService.updateStatus with the fixed target status "${expectedStatus}"`, async () => {
    const { service, ordersService } = makeService();
    ordersService.updateStatus.mockResolvedValue({ status: expectedStatus } as never);

    const result = await service[method]('order-1', actor, meta);

    expect(ordersService.updateStatus).toHaveBeenCalledWith('order-1', expectedStatus, actor, meta);
    expect(result).toEqual({ status: expectedStatus });
  });

  it('propagates whatever error OrdersService.updateStatus throws, unmodified', async () => {
    const { service, ordersService } = makeService();
    const error = new Error('boom');
    ordersService.updateStatus.mockRejectedValue(error);

    await expect(service[method]('order-1', actor, meta)).rejects.toBe(error);
  });
});
