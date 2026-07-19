import { Types } from 'mongoose';

import { NotFoundError } from '@errors/http-errors';
import { NotificationsService } from './notifications.service';
import type { NotificationsRepository } from './notifications.repository';
import type { INotification } from './notification.types';

const userId = new Types.ObjectId().toString();

function makeNotification(overrides: Partial<INotification> = {}): INotification {
  return {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(userId),
    title: 'Order Placed',
    message: 'Your order QB-2026-AAAAAAAA has been placed successfully.',
    type: 'order_placed',
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as INotification;
}

function makeMockRepository(): jest.Mocked<NotificationsRepository> {
  return {
    create: jest.fn(),
    findByUser: jest.fn(),
    countUnread: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteById: jest.fn(),
  } as unknown as jest.Mocked<NotificationsRepository>;
}

function makeService(overrides: { repo?: jest.Mocked<NotificationsRepository> } = {}) {
  const repo = overrides.repo ?? makeMockRepository();
  return { service: new NotificationsService(repo), repo };
}

// isRead: undefined is explicit, not omitted — Zod's .optional().transform()
// infers a required key whose *value* can be undefined, not an optional key.
const defaultQuery = { page: 1, limit: 20, isRead: undefined, sortOrder: 'desc' as const };

describe('NotificationsService.listMyNotifications', () => {
  it('delegates to the repository, scoped to the given user, and maps to DTOs', async () => {
    const { service, repo } = makeService();
    repo.findByUser.mockResolvedValue({ notifications: [makeNotification()], total: 1 });

    const result = await service.listMyNotifications(userId, defaultQuery);

    expect(repo.findByUser).toHaveBeenCalledWith(expect.objectContaining({ userId }));
    expect(result.total).toBe(1);
    expect(result.notifications[0].title).toBe('Order Placed');
  });
});

describe('NotificationsService.getUnreadCount', () => {
  it('delegates to the repository', async () => {
    const { service, repo } = makeService();
    repo.countUnread.mockResolvedValue(3);

    await expect(service.getUnreadCount(userId)).resolves.toBe(3);
  });
});

describe('NotificationsService.markAsRead', () => {
  it('returns the updated notification', async () => {
    const { service, repo } = makeService();
    repo.markAsRead.mockResolvedValue(makeNotification({ isRead: true }));

    const result = await service.markAsRead('id', userId);

    expect(result.isRead).toBe(true);
  });

  it('throws NotFoundError when the repository returns null (missing or not owned)', async () => {
    const { service, repo } = makeService();
    repo.markAsRead.mockResolvedValue(null);

    await expect(service.markAsRead('id', userId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('NotificationsService.markAllAsRead', () => {
  it('returns the updated count', async () => {
    const { service, repo } = makeService();
    repo.markAllAsRead.mockResolvedValue(4);

    await expect(service.markAllAsRead(userId)).resolves.toEqual({ updatedCount: 4 });
  });
});

describe('NotificationsService.deleteNotification', () => {
  it('resolves when the repository confirms deletion', async () => {
    const { service, repo } = makeService();
    repo.deleteById.mockResolvedValue(true);

    await expect(service.deleteNotification('id', userId)).resolves.toBeUndefined();
  });

  it('throws NotFoundError when the repository returns false (missing or not owned)', async () => {
    const { service, repo } = makeService();
    repo.deleteById.mockResolvedValue(false);

    await expect(service.deleteNotification('id', userId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('NotificationsService.notifyOrderEvent', () => {
  const orderId = new Types.ObjectId().toString();

  it.each([
    ['order_placed', 'Order Placed'],
    ['order_accepted', 'Order Accepted'],
    ['order_preparing', 'Order Preparing'],
    ['order_ready', 'Order Ready for Pickup'],
    ['order_completed', 'Order Completed'],
    ['order_cancelled', 'Order Cancelled'],
  ] as const)('writes a %s notification with title "%s"', async (type, expectedTitle) => {
    const { service, repo } = makeService();
    repo.create.mockResolvedValue(makeNotification({ type }));

    await service.notifyOrderEvent({ userId, type, orderId, orderNumber: 'QB-2026-AAAAAAAA' });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId, type, orderId, title: expectedTitle }),
    );
  });

  it('includes the pickupToken in the order_ready message when provided', async () => {
    const { service, repo } = makeService();
    repo.create.mockResolvedValue(makeNotification({ type: 'order_ready' }));

    await service.notifyOrderEvent({
      userId,
      type: 'order_ready',
      orderId,
      orderNumber: 'QB-2026-AAAAAAAA',
      pickupToken: '482913',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('482913') }),
    );
  });

  it('includes the cancellationReason in the order_cancelled message when provided', async () => {
    const { service, repo } = makeService();
    repo.create.mockResolvedValue(makeNotification({ type: 'order_cancelled' }));

    await service.notifyOrderEvent({
      userId,
      type: 'order_cancelled',
      orderId,
      orderNumber: 'QB-2026-AAAAAAAA',
      cancellationReason: 'Out of stock',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Out of stock') }),
    );
  });

  it('never throws, even when the repository rejects', async () => {
    const { service, repo } = makeService();
    repo.create.mockRejectedValue(new Error('DB unavailable'));

    await expect(
      service.notifyOrderEvent({ userId, type: 'order_placed', orderId, orderNumber: 'QB-2026-X' }),
    ).resolves.toBeUndefined();
  });
});
