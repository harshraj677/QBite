import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '../../app';
import { AuditLogModel } from '@modules/audit/audit-log.model';
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

/** Mints a valid access token directly, bypassing /auth/login — same pattern as canteens/menu integration tests; this suite isn't testing auth. */
function tokenFor(user: IUser): string {
  return signAccessToken({ sub: user._id.toString(), role: user.role }).token;
}

async function authHeaderFor(role: IUser['role']): Promise<{ Authorization: string; user: IUser }> {
  const { user } = await createTestUser({ role });
  return { Authorization: `Bearer ${tokenFor(user)}`, user };
}

async function setupCanteenWithItem(
  adminAuth: string,
  itemOverrides: Record<string, unknown> = {},
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
    .send({
      categoryId,
      name: 'Veg Puff',
      price,
      preparationTimeMinutes: 5,
      isVeg: true,
      ...itemOverrides,
    });

  return { canteenId, categoryId, menuItemId: itemRes.body.data.item.id as string, price };
}

async function placeOrder(
  studentAuth: string,
  canteenId: string,
  menuItemId: string,
  quantity = 2,
) {
  return request(app)
    .post(`/api/v1/canteens/${canteenId}/orders`)
    .set('Authorization', studentAuth)
    .send({ items: [{ menuItemId, quantity }], paymentMethod: 'cash' });
}

describe('POST /canteens/:canteenId/orders', () => {
  it('allows a student to place an order with server-computed pricing', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { canteenId, menuItemId, price } = await setupCanteenWithItem(adminAuth);

    const res = await placeOrder(studentAuth, canteenId, menuItemId, 2);

    expect(res.status).toBe(201);
    expect(res.body.data.order).toMatchObject({
      canteenId,
      studentId: student._id.toString(),
      status: 'pending',
      paymentStatus: 'pending',
      subtotal: price * 2,
      totalAmount: price * 2,
    });
    expect(res.body.data.order.orderNumber).toEqual(expect.any(String));
    expect(res.body.data.order.pickupToken).toMatch(/^\d{6}$/);
    expect(res.body.data.order.items).toHaveLength(1);
    expect(res.body.data.order.items[0].itemSnapshot).toMatchObject({
      itemName: 'Veg Puff',
      categoryName: 'Snacks',
      isVeg: true,
    });
  });

  it('forbids a non-student from placing an order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);

    const res = await placeOrder(adminAuth, canteenId, menuItemId, 1);

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/orders`)
      .send({ items: [{ menuItemId, quantity: 1 }], paymentMethod: 'cash' });

    expect(res.status).toBe(401);
  });

  it('rejects an empty items array with 400', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId } = await setupCanteenWithItem(adminAuth);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/orders`)
      .set('Authorization', studentAuth)
      .send({ items: [], paymentMethod: 'cash' });

    expect(res.status).toBe(400);
  });

  it('rejects an unavailable item with 422', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth, { isAvailable: false });

    const res = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_ITEM_NOT_AVAILABLE');
  });

  it('rejects an item that belongs to a different canteen with 422', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { menuItemId } = await setupCanteenWithItem(adminAuth);
    const otherCanteen = await setupCanteenWithItem(adminAuth);

    const res = await placeOrder(studentAuth, otherCanteen.canteenId, menuItemId, 1);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_ITEM_CANTEEN_MISMATCH');
  });

  it('returns 404 for a non-existent menu item', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId } = await setupCanteenWithItem(adminAuth);

    const res = await placeOrder(studentAuth, canteenId, '507f1f77bcf86cd799439011', 1);

    expect(res.status).toBe(404);
  });

  it('uses the max preparation time across items as estimatedReadyTimeMinutes', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const {
      canteenId,
      categoryId,
      menuItemId: fastItem,
    } = await setupCanteenWithItem(adminAuth, {
      name: 'Fast Item',
      preparationTimeMinutes: 3,
    });
    const slowItemRes = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', adminAuth)
      .send({
        categoryId,
        name: 'Slow Item',
        price: 5000,
        preparationTimeMinutes: 15,
        isVeg: true,
      });
    const slowItem = slowItemRes.body.data.item.id as string;

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/orders`)
      .set('Authorization', studentAuth)
      .send({
        items: [
          { menuItemId: fastItem, quantity: 1 },
          { menuItemId: slowItem, quantity: 1 },
        ],
        paymentMethod: 'cash',
      });

    expect(res.body.data.order.estimatedReadyTimeMinutes).toBe(15);
  });

  it('writes an order.created audit log entry', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);

    const res = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const log = await AuditLogModel.findOne({ action: 'order.created', actorId: student._id });
    expect(log).not.toBeNull();
    expect(log?.metadata).toMatchObject({ orderId: res.body.data.order.id, canteenId });
  });
});

describe('GET /orders/:id', () => {
  it('allows the owning student to view their order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .get(`/api/v1/orders/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.order.items).toHaveLength(1);
  });

  it('forbids a different student from viewing the order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .get(`/api/v1/orders/${order.body.data.order.id}`)
      .set('Authorization', otherStudentAuth);

    expect(res.status).toBe(403);
  });

  it('allows kitchen_staff and admin to view any order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .get(`/api/v1/orders/${order.body.data.order.id}`)
      .set('Authorization', staffAuth);

    expect(res.status).toBe(200);
  });

  it('returns 404 for a non-existent order', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .get('/api/v1/orders/507f1f77bcf86cd799439011')
      .set('Authorization', studentAuth);

    expect(res.status).toBe(404);
  });
});

describe('GET /students/me/orders', () => {
  it('returns only the authenticated student’s own orders', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId, 1);
    await placeOrder(otherStudentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .get('/api/v1/students/me/orders')
      .set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
  });

  it('forbids a non-student', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');

    const res = await request(app)
      .get('/api/v1/students/me/orders')
      .set('Authorization', adminAuth);

    expect(res.status).toBe(403);
  });

  it('filters by status', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const orderA = await placeOrder(studentAuth, canteenId, menuItemId, 1);
    await placeOrder(studentAuth, canteenId, menuItemId, 1);
    await request(app)
      .patch(`/api/v1/orders/${orderA.body.data.order.id}/status`)
      .set('Authorization', staffAuth)
      .send({ status: 'accepted' });

    const res = await request(app)
      .get('/api/v1/students/me/orders')
      .query({ status: 'accepted' })
      .set('Authorization', studentAuth);

    expect(res.body.meta.total).toBe(1);
  });
});

describe('GET /canteens/:canteenId/orders', () => {
  it('allows kitchen_staff and admin to list a canteen’s orders', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/orders`)
      .set('Authorization', staffAuth);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
  });

  it('forbids a student', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId } = await setupCanteenWithItem(adminAuth);

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/orders`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });

  it('filters by studentId', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId, 1);
    await placeOrder(otherStudentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/orders`)
      .query({ studentId: student._id.toString() })
      .set('Authorization', staffAuth);

    expect(res.body.meta.total).toBe(1);
  });

  it('filters by orderNumber', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);
    await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/orders`)
      .query({ orderNumber: order.body.data.order.orderNumber })
      .set('Authorization', staffAuth);

    expect(res.body.meta.total).toBe(1);
  });
});

describe('PATCH /orders/:id/status', () => {
  it('advances an order through the full pipeline', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);
    const id = order.body.data.order.id as string;

    for (const status of ['accepted', 'preparing', 'ready', 'completed']) {
      const res = await request(app)
        .patch(`/api/v1/orders/${id}/status`)
        .set('Authorization', staffAuth)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe(status);
    }

    const final = await request(app).get(`/api/v1/orders/${id}`).set('Authorization', staffAuth);
    expect(final.body.data.order.acceptedAt).not.toBeNull();
    expect(final.body.data.order.completedAt).not.toBeNull();
  });

  it('forbids a student from updating status', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/status`)
      .set('Authorization', studentAuth)
      .send({ status: 'accepted' });

    expect(res.status).toBe(403);
  });

  it('rejects skipping a stage with 409', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/status`)
      .set('Authorization', staffAuth)
      .send({ status: 'ready' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_INVALID_STATUS_TRANSITION');
  });

  it('rejects a duplicate transition to the current status', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);
    const id = order.body.data.order.id as string;
    await request(app)
      .patch(`/api/v1/orders/${id}/status`)
      .set('Authorization', staffAuth)
      .send({ status: 'accepted' });

    const res = await request(app)
      .patch(`/api/v1/orders/${id}/status`)
      .set('Authorization', staffAuth)
      .send({ status: 'accepted' });

    expect(res.status).toBe(409);
  });

  it('rejects updating status on a completed order (immutable)', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);
    const id = order.body.data.order.id as string;
    for (const status of ['accepted', 'preparing', 'ready', 'completed']) {
      await request(app)
        .patch(`/api/v1/orders/${id}/status`)
        .set('Authorization', staffAuth)
        .send({ status });
    }

    const res = await request(app)
      .patch(`/api/v1/orders/${id}/status`)
      .set('Authorization', staffAuth)
      .send({ status: 'completed' });

    expect(res.status).toBe(409);
  });

  it('writes an order.status_updated audit log entry', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth, user: staff } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/status`)
      .set('Authorization', staffAuth)
      .send({ status: 'accepted' });

    const log = await AuditLogModel.findOne({ action: 'order.status_updated', actorId: staff._id });
    expect(log).not.toBeNull();
  });
});

describe('PATCH /orders/:id/cancel', () => {
  it('allows the owning student to cancel a pending order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/cancel`)
      .set('Authorization', studentAuth)
      .send({ cancellationReason: 'Changed my mind' });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('cancelled');
    expect(res.body.data.order.cancellationReason).toBe('Changed my mind');
  });

  it('forbids a student from cancelling another student’s order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { Authorization: otherStudentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/cancel`)
      .set('Authorization', otherStudentAuth)
      .send({});

    expect(res.status).toBe(403);
  });

  it('rejects a student cancelling a non-pending order with 409', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);
    await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/status`)
      .set('Authorization', staffAuth)
      .send({ status: 'accepted' });

    const res = await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/cancel`)
      .set('Authorization', studentAuth)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_CANNOT_BE_CANCELLED');
  });

  it('allows an admin to cancel an order that is already accepted', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);
    await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/status`)
      .set('Authorization', staffAuth)
      .send({ status: 'accepted' });

    const res = await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/cancel`)
      .set('Authorization', adminAuth)
      .send({ cancellationReason: 'Out of stock' });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('cancelled');
  });

  it('forbids kitchen_staff from cancelling', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    const res = await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/cancel`)
      .set('Authorization', staffAuth)
      .send({});

    expect(res.status).toBe(403);
  });

  it('rejects cancelling a completed order even for an admin', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);
    const id = order.body.data.order.id as string;
    for (const status of ['accepted', 'preparing', 'ready', 'completed']) {
      await request(app)
        .patch(`/api/v1/orders/${id}/status`)
        .set('Authorization', staffAuth)
        .send({ status });
    }

    const res = await request(app)
      .patch(`/api/v1/orders/${id}/cancel`)
      .set('Authorization', adminAuth)
      .send({});

    expect(res.status).toBe(409);
  });

  it('writes an order.cancelled audit log entry', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId, 1);

    await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/cancel`)
      .set('Authorization', studentAuth)
      .send({});

    const log = await AuditLogModel.findOne({ action: 'order.cancelled', actorId: student._id });
    expect(log).not.toBeNull();
  });
});
