import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { NotificationModel } from './notification.model';
import { NotificationsRepository } from './notifications.repository';
import type { CreateNotificationInput } from './notifications.repository';

const repository = new NotificationsRepository();
const userId = new Types.ObjectId();

function makeInput(overrides: Partial<CreateNotificationInput> = {}): CreateNotificationInput {
  return {
    userId,
    title: 'Order Placed',
    message: 'Your order QB-2026-AAAAAAAA has been placed successfully.',
    type: 'order_placed',
    orderId: new Types.ObjectId(),
    ...overrides,
  };
}

beforeAll(async () => {
  await connectTestDb();
  await NotificationModel.init();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('NotificationsRepository.create', () => {
  it('creates a notification with isRead defaulting to false', async () => {
    const created = await repository.create(makeInput());
    expect(created.isRead).toBe(false);
    expect(created.type).toBe('order_placed');
  });
});

describe('NotificationsRepository.findByUser', () => {
  beforeEach(async () => {
    await repository.create(makeInput({ title: 'A' }));
    await repository.create(makeInput({ title: 'B' }));
    await repository.create(makeInput({ userId: new Types.ObjectId(), title: 'Other user' }));
  });

  it('scopes results to the given user only', async () => {
    const result = await repository.findByUser({
      userId,
      page: 1,
      limit: 10,
      sortOrder: 'desc',
    });
    expect(result.total).toBe(2);
  });

  it('sorts newest first by default (desc)', async () => {
    const result = await repository.findByUser({ userId, page: 1, limit: 10, sortOrder: 'desc' });
    expect(result.notifications.map((n) => n.title)).toEqual(['B', 'A']);
  });

  it('sorts oldest first (asc)', async () => {
    const result = await repository.findByUser({ userId, page: 1, limit: 10, sortOrder: 'asc' });
    expect(result.notifications.map((n) => n.title)).toEqual(['A', 'B']);
  });

  it('filters by isRead', async () => {
    const all = await repository.findByUser({ userId, page: 1, limit: 10, sortOrder: 'asc' });
    await repository.markAsRead(all.notifications[0]._id, userId);

    const unreadOnly = await repository.findByUser({
      userId,
      page: 1,
      limit: 10,
      isRead: false,
      sortOrder: 'asc',
    });
    expect(unreadOnly.total).toBe(1);
  });

  it('paginates', async () => {
    const page1 = await repository.findByUser({ userId, page: 1, limit: 1, sortOrder: 'asc' });
    expect(page1.notifications).toHaveLength(1);
    expect(page1.total).toBe(2);
  });
});

describe('NotificationsRepository.countUnread', () => {
  it('counts only unread notifications for the given user', async () => {
    const a = await repository.create(makeInput());
    await repository.create(makeInput());
    await repository.create(makeInput({ userId: new Types.ObjectId() }));
    await repository.markAsRead(a._id, userId);

    expect(await repository.countUnread(userId)).toBe(1);
  });
});

describe('NotificationsRepository.markAsRead', () => {
  it('marks a notification read and returns it', async () => {
    const created = await repository.create(makeInput());

    const updated = await repository.markAsRead(created._id, userId);

    expect(updated?.isRead).toBe(true);
  });

  it('is idempotent — marking an already-read notification read again succeeds', async () => {
    const created = await repository.create(makeInput());
    await repository.markAsRead(created._id, userId);

    const result = await repository.markAsRead(created._id, userId);

    expect(result?.isRead).toBe(true);
  });

  it('returns null when the notification belongs to a different user', async () => {
    const created = await repository.create(makeInput());

    const result = await repository.markAsRead(created._id, new Types.ObjectId());

    expect(result).toBeNull();
  });

  it('returns null for a non-existent id', async () => {
    const result = await repository.markAsRead(new Types.ObjectId(), userId);
    expect(result).toBeNull();
  });
});

describe('NotificationsRepository.markAllAsRead', () => {
  it('marks every unread notification for the user as read and returns the count', async () => {
    await repository.create(makeInput());
    await repository.create(makeInput());
    await repository.create(makeInput({ userId: new Types.ObjectId() }));

    const count = await repository.markAllAsRead(userId);

    expect(count).toBe(2);
    expect(await repository.countUnread(userId)).toBe(0);
  });

  it('returns 0 when there is nothing to mark', async () => {
    expect(await repository.markAllAsRead(userId)).toBe(0);
  });
});

describe('NotificationsRepository.deleteById', () => {
  it('deletes a notification owned by the user', async () => {
    const created = await repository.create(makeInput());

    const result = await repository.deleteById(created._id, userId);

    expect(result).toBe(true);
    expect(await NotificationModel.findById(created._id)).toBeNull();
  });

  it('returns false when the notification belongs to a different user, without deleting it', async () => {
    const created = await repository.create(makeInput());

    const result = await repository.deleteById(created._id, new Types.ObjectId());

    expect(result).toBe(false);
    expect(await NotificationModel.findById(created._id)).not.toBeNull();
  });

  it('returns false for a non-existent id', async () => {
    const result = await repository.deleteById(new Types.ObjectId(), userId);
    expect(result).toBe(false);
  });
});
