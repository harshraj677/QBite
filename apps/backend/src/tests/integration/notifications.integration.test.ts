import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '../../app';
import { signAccessToken } from '@modules/auth/token.util';
import type { IUser } from '@modules/users/user.types';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/test-db';
import { createTestUser } from '../helpers/user-factory';

let app: Express;

beforeAll(async () => {
  await connectTestDb();
  app = createApp();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

/** Mints a valid access token directly, bypassing /auth/login — same pattern as every other integration suite; this one isn't testing auth either. */
function tokenFor(user: IUser): string {
  return signAccessToken({ sub: user._id.toString(), role: user.role }).token;
}

async function authHeaderFor(role: IUser['role']): Promise<{ Authorization: string; user: IUser }> {
  const { user } = await createTestUser({ role });
  return { Authorization: `Bearer ${tokenFor(user)}`, user };
}

async function setupCanteenWithItem(
  adminAuth: string,
): Promise<{ canteenId: string; categoryId: string; menuItemId: string; price: number }> {
  const unique = Math.random().toString(36).slice(2, 8);
  const canteenRes = await request(app)
    .post('/api/v1/canteens')
    .set('Authorization', adminAuth)
    .send({
      name: `Canteen ${unique}`,
      location: 'Block A, Ground Floor',
      contactNumber: '+919876543210',
      email: `${unique}@college.edu`,
      openingTime: '09:00',
      closingTime: '21:00',
    });
  const canteenId = canteenRes.body.data.canteen.id as string;

  const categoryRes = await request(app)
    .post(`/api/v1/canteens/${canteenId}/categories`)
    .set('Authorization', adminAuth)
    .send({ name: 'Snacks' });
  const categoryId = categoryRes.body.data.category.id as string;

  const price = 3000;
  const itemRes = await request(app)
    .post(`/api/v1/canteens/${canteenId}/menu-items`)
    .set('Authorization', adminAuth)
    .send({ categoryId, name: 'Veg Puff', price, preparationTimeMinutes: 5, isVeg: true });

  return { canteenId, categoryId, menuItemId: itemRes.body.data.item.id as string, price };
}

async function placeOrder(studentAuth: string, canteenId: string, menuItemId: string) {
  return request(app)
    .post(`/api/v1/canteens/${canteenId}/orders`)
    .set('Authorization', studentAuth)
    .send({ items: [{ menuItemId, quantity: 1 }], paymentMethod: 'cash' });
}

describe('order lifecycle -> notification auto-creation', () => {
  it('creates an order_placed notification for the placing student', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);

    const order = await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      type: 'order_placed',
      orderId: order.body.data.order.id,
      isRead: false,
    });
    expect(res.body.data[0].message).toContain(order.body.data.order.orderNumber);
  });

  it('creates a distinct notification for each kitchen transition, all for the student, none for the staff actor', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const id = order.body.data.order.id as string;

    for (const action of ['accept', 'start-preparing', 'ready', 'complete']) {
      await request(app)
        .patch(`/api/v1/kitchen/orders/${id}/${action}`)
        .set('Authorization', staffAuth);
    }

    const studentNotifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', studentAuth);
    expect(studentNotifications.body.meta.total).toBe(5); // placed + 4 transitions
    expect(studentNotifications.body.data.map((n: { type: string }) => n.type).sort()).toEqual(
      [
        'order_accepted',
        'order_completed',
        'order_placed',
        'order_preparing',
        'order_ready',
      ].sort(),
    );

    const staffNotifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', staffAuth);
    expect(staffNotifications.body.meta.total).toBe(0);
  });

  it('includes the pickupToken in the order_ready notification message', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    const id = order.body.data.order.id as string;
    await request(app).patch(`/api/v1/kitchen/orders/${id}/accept`).set('Authorization', staffAuth);
    await request(app)
      .patch(`/api/v1/kitchen/orders/${id}/start-preparing`)
      .set('Authorization', staffAuth);
    await request(app).patch(`/api/v1/kitchen/orders/${id}/ready`).set('Authorization', staffAuth);

    const res = await request(app)
      .get('/api/v1/notifications')
      .query({ isRead: 'false' })
      .set('Authorization', studentAuth);

    const readyNotification = res.body.data.find((n: { type: string }) => n.type === 'order_ready');
    expect(readyNotification.message).toContain(order.body.data.order.pickupToken);
  });

  it('creates an order_cancelled notification with the reason', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);

    await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/cancel`)
      .set('Authorization', studentAuth)
      .send({ cancellationReason: 'Changed my mind' });

    const res = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);

    const cancelled = res.body.data.find((n: { type: string }) => n.type === 'order_cancelled');
    expect(cancelled).toBeDefined();
    expect(cancelled.message).toContain('Changed my mind');
  });
});

describe('GET /notifications', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('paginates and sorts newest-first by default', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);
    await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .get('/api/v1/notifications')
      .query({ page: 1, limit: 1 })
      .set('Authorization', studentAuth);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(2);
  });

  it('filters by isRead', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);
    const list = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);
    await request(app)
      .patch(`/api/v1/notifications/${list.body.data[0].id}/read`)
      .set('Authorization', studentAuth);

    const unread = await request(app)
      .get('/api/v1/notifications')
      .query({ isRead: 'false' })
      .set('Authorization', studentAuth);

    expect(unread.body.meta.total).toBe(0);
  });
});

describe('GET /notifications/unread-count', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('reflects the number of unread notifications', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);
    await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', studentAuth);

    expect(res.body.data.count).toBe(2);
  });
});

describe('PATCH /notifications/:id/read', () => {
  it('marks a notification read, idempotently', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);
    const list = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);
    const id = list.body.data[0].id as string;

    const first = await request(app)
      .patch(`/api/v1/notifications/${id}/read`)
      .set('Authorization', studentAuth);
    expect(first.status).toBe(200);
    expect(first.body.data.notification.isRead).toBe(true);

    const second = await request(app)
      .patch(`/api/v1/notifications/${id}/read`)
      .set('Authorization', studentAuth);
    expect(second.status).toBe(200);
  });

  it('returns 404 (not 403) for a notification belonging to a different user', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);
    const list = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);
    const id = list.body.data[0].id as string;

    const res = await request(app)
      .patch(`/api/v1/notifications/${id}/read`)
      .set('Authorization', otherStudentAuth);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-existent id', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .patch('/api/v1/notifications/507f1f77bcf86cd799439011/read')
      .set('Authorization', studentAuth);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /notifications/read-all', () => {
  it('marks every unread notification as read and returns the count', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);
    await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', studentAuth);

    expect(res.body.data.updatedCount).toBe(2);

    const unreadCount = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', studentAuth);
    expect(unreadCount.body.data.count).toBe(0);
  });

  it('does not affect another user’s notifications', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);

    await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', otherStudentAuth);

    const unreadCount = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', studentAuth);
    expect(unreadCount.body.data.count).toBe(1);
  });
});

describe('DELETE /notifications/:id', () => {
  it('deletes a notification owned by the authenticated user', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);
    const list = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);
    const id = list.body.data[0].id as string;

    const res = await request(app)
      .delete(`/api/v1/notifications/${id}`)
      .set('Authorization', studentAuth);
    expect(res.status).toBe(200);

    const after = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);
    expect(after.body.meta.total).toBe(0);
  });

  it('returns 404 (not 403) and does not delete when the notification belongs to a different user', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);
    const list = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);
    const id = list.body.data[0].id as string;

    const res = await request(app)
      .delete(`/api/v1/notifications/${id}`)
      .set('Authorization', otherStudentAuth);
    expect(res.status).toBe(404);

    const after = await request(app).get('/api/v1/notifications').set('Authorization', studentAuth);
    expect(after.body.meta.total).toBe(1);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).delete('/api/v1/notifications/507f1f77bcf86cd799439011');
    expect(res.status).toBe(401);
  });
});
