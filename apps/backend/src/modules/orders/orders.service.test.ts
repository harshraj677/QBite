import { Types } from 'mongoose';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '@errors/http-errors';
import type { AuditLogService } from '@modules/audit/audit-log.service';
import type { CanteensService } from '@modules/canteens/canteens.service';
import type { MenuCategoriesService } from '@modules/menu/menu-categories.service';
import type { MenuItemsService } from '@modules/menu/menu-items.service';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import { OrdersService } from './orders.service';
import type { OrderItemsRepository } from './order-items.repository';
import type { OrdersRepository } from './orders.repository';
import type { IOrder } from './order.types';
import type { IOrderItem } from './order-item.types';

const canteenId = new Types.ObjectId().toString();
const studentId = new Types.ObjectId().toString();
const menuItemId = new Types.ObjectId().toString();
const categoryId = new Types.ObjectId().toString();
const student = { id: studentId, role: 'student' as const };
const admin = { id: new Types.ObjectId().toString(), role: 'admin' as const };
const meta = {};

function makeOrder(overrides: Partial<IOrder> = {}): IOrder {
  return {
    _id: new Types.ObjectId(),
    orderNumber: 'QB-2026-ABCD1234',
    canteenId: new Types.ObjectId(canteenId),
    studentId: new Types.ObjectId(studentId),
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    subtotal: 3000,
    tax: 0,
    discount: 0,
    totalAmount: 3000,
    pickupToken: '123456',
    estimatedReadyTimeMinutes: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IOrder;
}

function makeOrderItem(overrides: Partial<IOrderItem> = {}): IOrderItem {
  return {
    _id: new Types.ObjectId(),
    orderId: new Types.ObjectId(),
    menuItemId: new Types.ObjectId(menuItemId),
    quantity: 1,
    unitPrice: 3000,
    totalPrice: 3000,
    itemSnapshot: {
      itemId: menuItemId,
      itemName: 'Veg Puff',
      categoryName: 'Snacks',
      unitPrice: 3000,
      isVeg: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IOrderItem;
}

function makeMockOrdersRepository(): jest.Mocked<OrdersRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByStudent: jest.fn(),
    findByCanteen: jest.fn(),
    search: jest.fn(),
    updateStatus: jest.fn(),
    cancelOrder: jest.fn(),
  } as unknown as jest.Mocked<OrdersRepository>;
}

function makeMockOrderItemsRepository(): jest.Mocked<OrderItemsRepository> {
  return {
    createMany: jest.fn(),
    findByOrderId: jest.fn(),
  } as unknown as jest.Mocked<OrderItemsRepository>;
}

function makeMockCanteensService(): jest.Mocked<CanteensService> {
  return {
    getCanteenById: jest.fn().mockResolvedValue({ id: canteenId }),
  } as unknown as jest.Mocked<CanteensService>;
}

function makeMockMenuCategoriesService(): jest.Mocked<MenuCategoriesService> {
  return {
    getCategoryById: jest.fn().mockResolvedValue({ id: categoryId, name: 'Snacks' }),
  } as unknown as jest.Mocked<MenuCategoriesService>;
}

function makeMockMenuItemsService(): jest.Mocked<MenuItemsService> {
  return {
    getItemById: jest.fn().mockResolvedValue({
      id: menuItemId,
      canteenId,
      categoryId,
      name: 'Veg Puff',
      price: 3000,
      preparationTimeMinutes: 5,
      isVeg: true,
      isAvailable: true,
    }),
  } as unknown as jest.Mocked<MenuItemsService>;
}

function makeMockAuditLogService(): jest.Mocked<AuditLogService> {
  return {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditLogService>;
}

function makeMockNotificationsService(): jest.Mocked<NotificationsService> {
  return {
    notifyOrderEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationsService>;
}

function makeService(
  overrides: {
    ordersRepo?: jest.Mocked<OrdersRepository>;
    orderItemsRepo?: jest.Mocked<OrderItemsRepository>;
    canteensService?: jest.Mocked<CanteensService>;
    categoriesService?: jest.Mocked<MenuCategoriesService>;
    itemsService?: jest.Mocked<MenuItemsService>;
    auditLogService?: jest.Mocked<AuditLogService>;
    notificationsService?: jest.Mocked<NotificationsService>;
  } = {},
) {
  const ordersRepo = overrides.ordersRepo ?? makeMockOrdersRepository();
  const orderItemsRepo = overrides.orderItemsRepo ?? makeMockOrderItemsRepository();
  const canteensService = overrides.canteensService ?? makeMockCanteensService();
  const categoriesService = overrides.categoriesService ?? makeMockMenuCategoriesService();
  const itemsService = overrides.itemsService ?? makeMockMenuItemsService();
  const auditLogService = overrides.auditLogService ?? makeMockAuditLogService();
  const notificationsService = overrides.notificationsService ?? makeMockNotificationsService();
  return {
    service: new OrdersService(
      ordersRepo,
      orderItemsRepo,
      canteensService,
      categoriesService,
      itemsService,
      auditLogService,
      notificationsService,
    ),
    ordersRepo,
    orderItemsRepo,
    canteensService,
    categoriesService,
    itemsService,
    auditLogService,
    notificationsService,
  };
}

const validInput = {
  items: [{ menuItemId, quantity: 2 }],
  paymentMethod: 'cash' as const,
};

describe('OrdersService.placeOrder', () => {
  it('computes pricing from the menu item price, not the client, and records an audit log', async () => {
    const { service, ordersRepo, orderItemsRepo, auditLogService } = makeService();
    orderItemsRepo.createMany.mockResolvedValue([makeOrderItem({ quantity: 2, totalPrice: 6000 })]);
    ordersRepo.create.mockResolvedValue(makeOrder({ subtotal: 6000, totalAmount: 6000 }));

    const result = await service.placeOrder(canteenId, validInput, student, meta);

    expect(ordersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 6000, totalAmount: 6000, studentId }),
    );
    expect(result.items).toHaveLength(1);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'order.created', success: true }),
    );
  });

  // Regression coverage for the Notifications phase's integration:
  // placeOrder must notify the placing student — see
  // ARCHITECTURE.md §3.1's `modules/notifications` note.
  it('notifies the placing student with type order_placed', async () => {
    const { service, ordersRepo, orderItemsRepo, notificationsService } = makeService();
    orderItemsRepo.createMany.mockResolvedValue([makeOrderItem()]);
    const order = makeOrder();
    ordersRepo.create.mockResolvedValue(order);

    await service.placeOrder(canteenId, validInput, student, meta);

    expect(notificationsService.notifyOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: order.studentId,
        type: 'order_placed',
        orderId: order._id,
        orderNumber: order.orderNumber,
      }),
    );
  });

  it('throws when the canteen does not exist', async () => {
    const { service, canteensService, ordersRepo } = makeService();
    canteensService.getCanteenById.mockRejectedValue(
      new NotFoundError('CANTEEN_NOT_FOUND', 'Canteen not found.'),
    );

    await expect(service.placeOrder(canteenId, validInput, student, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(ordersRepo.create).not.toHaveBeenCalled();
  });

  it('rejects an item that belongs to a different canteen', async () => {
    const { service, itemsService } = makeService();
    itemsService.getItemById.mockResolvedValue({
      id: menuItemId,
      canteenId: new Types.ObjectId().toString(),
      categoryId,
      name: 'Veg Puff',
      price: 3000,
      preparationTimeMinutes: 5,
      isVeg: true,
      isAvailable: true,
    } as never);

    await expect(service.placeOrder(canteenId, validInput, student, meta)).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );
  });

  it('rejects an unavailable item', async () => {
    const { service, itemsService } = makeService();
    itemsService.getItemById.mockResolvedValue({
      id: menuItemId,
      canteenId,
      categoryId,
      name: 'Veg Puff',
      price: 3000,
      preparationTimeMinutes: 5,
      isVeg: true,
      isAvailable: false,
    } as never);

    await expect(service.placeOrder(canteenId, validInput, student, meta)).rejects.toMatchObject({
      code: 'ORDER_ITEM_NOT_AVAILABLE',
    });
  });

  it('uses the max preparation time across items, not the sum', async () => {
    const { service, itemsService, ordersRepo, orderItemsRepo } = makeService();
    itemsService.getItemById
      .mockResolvedValueOnce({
        id: menuItemId,
        canteenId,
        categoryId,
        name: 'A',
        price: 1000,
        preparationTimeMinutes: 3,
        isVeg: true,
        isAvailable: true,
      } as never)
      .mockResolvedValueOnce({
        id: new Types.ObjectId().toString(),
        canteenId,
        categoryId,
        name: 'B',
        price: 1000,
        preparationTimeMinutes: 10,
        isVeg: true,
        isAvailable: true,
      } as never);
    orderItemsRepo.createMany.mockResolvedValue([makeOrderItem(), makeOrderItem()]);
    ordersRepo.create.mockResolvedValue(makeOrder());

    await service.placeOrder(
      canteenId,
      {
        items: [
          { menuItemId, quantity: 1 },
          { menuItemId, quantity: 1 },
        ],
        paymentMethod: 'cash',
      },
      student,
      meta,
    );

    expect(ordersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedReadyTimeMinutes: 10 }),
    );
  });

  it('retries orderNumber generation on a duplicate-key collision without recreating order items', async () => {
    const { service, ordersRepo, orderItemsRepo } = makeService();
    orderItemsRepo.createMany.mockResolvedValue([makeOrderItem()]);
    ordersRepo.create.mockRejectedValueOnce({ code: 11000 }).mockResolvedValueOnce(makeOrder());

    await service.placeOrder(canteenId, validInput, student, meta);

    expect(orderItemsRepo.createMany).toHaveBeenCalledTimes(1);
    expect(ordersRepo.create).toHaveBeenCalledTimes(2);
  });
});

describe('OrdersService.getOrderById', () => {
  it('returns the order with its items when found', async () => {
    const { service, ordersRepo, orderItemsRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder());
    orderItemsRepo.findByOrderId.mockResolvedValue([makeOrderItem()]);

    const result = await service.getOrderById('id', student);

    expect(result.items).toHaveLength(1);
  });

  it('throws NotFoundError when missing', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(null);

    await expect(service.getOrderById('missing', student)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('forbids a student from viewing another student’s order', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ studentId: new Types.ObjectId() }));

    await expect(service.getOrderById('id', student)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows an admin to view any order', async () => {
    const { service, ordersRepo, orderItemsRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ studentId: new Types.ObjectId() }));
    orderItemsRepo.findByOrderId.mockResolvedValue([]);

    await expect(service.getOrderById('id', admin)).resolves.toBeDefined();
  });
});

describe('OrdersService.searchOrders', () => {
  it('delegates to the repository unscoped (no studentId/canteenId) and maps to DTOs', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.search.mockResolvedValue({ orders: [makeOrder()], total: 1 });

    const result = await service.searchOrders({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(ordersRepo.search).toHaveBeenCalledWith(
      expect.not.objectContaining({ studentId: expect.anything(), canteenId: expect.anything() }),
    );
    expect(result.total).toBe(1);
  });

  it('passes the pickupToken filter through untouched', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.search.mockResolvedValue({ orders: [], total: 0 });

    await service.searchOrders({
      pickupToken: '482913',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(ordersRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ pickupToken: '482913' }),
    );
  });
});

describe('OrdersService.updateStatus', () => {
  it('advances a valid transition and records an audit log', async () => {
    const { service, ordersRepo, auditLogService } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'pending' }));
    ordersRepo.updateStatus.mockResolvedValue(makeOrder({ status: 'accepted' }));

    const result = await service.updateStatus('id', 'accepted', admin, meta);

    expect(result.status).toBe('accepted');
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'order.accepted' }),
    );
  });

  // Regression coverage for the Kitchen Workflow phase's audit-naming
  // change: this method used to log one generic 'order.status_updated'
  // for every transition — replaced with a precise action per target
  // status (see orders.service.ts's statusUpdateAuditAction) so both
  // the direct /status endpoint and every Kitchen endpoint that calls
  // this same method produce a distinguishable audit event.
  it.each([
    ['pending', 'accepted', 'order.accepted'],
    ['accepted', 'preparing', 'order.preparing'],
    ['preparing', 'ready', 'order.ready'],
    ['ready', 'completed', 'order.completed'],
  ] as const)('logs %s -> %s as %s, not a generic action', async (from, to, expectedAction) => {
    const { service, ordersRepo, auditLogService } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: from }));
    ordersRepo.updateStatus.mockResolvedValue(makeOrder({ status: to }));

    await service.updateStatus('id', to, admin, meta);

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: expectedAction }),
    );
  });

  // Regression coverage for the Notifications phase's integration —
  // same per-transition mapping as the audit-action test above, but
  // for notifyOrderEvent (see orders.service.ts's statusNotificationType).
  it.each([
    ['pending', 'accepted', 'order_accepted'],
    ['accepted', 'preparing', 'order_preparing'],
    ['preparing', 'ready', 'order_ready'],
    ['ready', 'completed', 'order_completed'],
  ] as const)('notifies the student of %s -> %s as %s', async (from, to, expectedType) => {
    const { service, ordersRepo, notificationsService } = makeService();
    const order = makeOrder({ status: from });
    ordersRepo.findById.mockResolvedValue(order);
    ordersRepo.updateStatus.mockResolvedValue(makeOrder({ status: to }));

    await service.updateStatus('id', to, admin, meta);

    expect(notificationsService.notifyOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: order.studentId, type: expectedType }),
    );
  });

  it('does not notify when the transition is rejected', async () => {
    const { service, ordersRepo, notificationsService } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'pending' }));

    await expect(service.updateStatus('id', 'ready', admin, meta)).rejects.toBeDefined();

    expect(notificationsService.notifyOrderEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid transition (skipping a stage)', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'pending' }));

    await expect(service.updateStatus('id', 'ready', admin, meta)).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATUS_TRANSITION',
    });
    expect(ordersRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects a duplicate transition to the same status', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'accepted' }));

    await expect(service.updateStatus('id', 'accepted', admin, meta)).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATUS_TRANSITION',
    });
  });

  it('rejects any transition on a completed order (immutable)', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'completed' }));

    await expect(service.updateStatus('id', 'ready', admin, meta)).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATUS_TRANSITION',
    });
  });

  it('throws NotFoundError when missing', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(null);

    await expect(service.updateStatus('id', 'accepted', admin, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('surfaces a race (repository returns null) as the same domain error', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'pending' }));
    ordersRepo.updateStatus.mockResolvedValue(null);

    await expect(service.updateStatus('id', 'accepted', admin, meta)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('OrdersService.cancelOrder', () => {
  it('allows the owning student to cancel a pending order', async () => {
    const { service, ordersRepo, auditLogService } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'pending' }));
    ordersRepo.cancelOrder.mockResolvedValue(makeOrder({ status: 'cancelled' }));

    const result = await service.cancelOrder('id', 'Changed my mind', student, meta);

    expect(result.status).toBe('cancelled');
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'order.cancelled' }),
    );
  });

  // Regression coverage for the Notifications phase's integration.
  it('notifies the student with type order_cancelled and the reason', async () => {
    const { service, ordersRepo, notificationsService } = makeService();
    const order = makeOrder({ status: 'pending' });
    ordersRepo.findById.mockResolvedValue(order);
    ordersRepo.cancelOrder.mockResolvedValue(makeOrder({ status: 'cancelled' }));

    await service.cancelOrder('id', 'Changed my mind', student, meta);

    expect(notificationsService.notifyOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: order.studentId,
        type: 'order_cancelled',
        cancellationReason: 'Changed my mind',
      }),
    );
  });

  it('forbids a student from cancelling another student’s order', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(
      makeOrder({ status: 'pending', studentId: new Types.ObjectId() }),
    );

    await expect(service.cancelOrder('id', undefined, student, meta)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects a student cancelling a non-pending order', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'accepted' }));

    await expect(service.cancelOrder('id', undefined, student, meta)).rejects.toMatchObject({
      code: 'ORDER_CANNOT_BE_CANCELLED',
    });
  });

  it('allows an admin to cancel an order that is already accepted', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'accepted' }));
    ordersRepo.cancelOrder.mockResolvedValue(makeOrder({ status: 'cancelled' }));

    await expect(service.cancelOrder('id', 'Out of stock', admin, meta)).resolves.toBeDefined();
  });

  it('rejects cancelling a completed order even for an admin', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(makeOrder({ status: 'completed' }));

    await expect(service.cancelOrder('id', undefined, admin, meta)).rejects.toMatchObject({
      code: 'ORDER_CANNOT_BE_CANCELLED',
    });
    expect(ordersRepo.cancelOrder).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when missing', async () => {
    const { service, ordersRepo } = makeService();
    ordersRepo.findById.mockResolvedValue(null);

    await expect(service.cancelOrder('id', undefined, student, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
