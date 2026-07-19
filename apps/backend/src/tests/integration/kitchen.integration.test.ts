import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '../../app';
import { AuditLogModel } from '@modules/audit/audit-log.model';
import type { AuditAction } from '@modules/audit/audit-log.types';
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

describe('GET /kitchen/orders', () => {
  it('lists orders across every canteen, unscoped', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const canteenA = await setupCanteenWithItem(adminAuth);
    const canteenB = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenA.canteenId, canteenA.menuItemId);
    await placeOrder(studentAuth, canteenB.canteenId, canteenB.menuItemId);

    const res = await request(app).get('/api/v1/kitchen/orders').set('Authorization', staffAuth);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
  });

  it('allows admin and super_admin too', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: superAdminAuth } = await authHeaderFor('super_admin');

    const asAdmin = await request(app)
      .get('/api/v1/kitchen/orders')
      .set('Authorization', adminAuth);
    const asSuperAdmin = await request(app)
      .get('/api/v1/kitchen/orders')
      .set('Authorization', superAdminAuth);

    expect(asAdmin.status).toBe(200);
    expect(asSuperAdmin.status).toBe(200);
  });

  it('forbids a student', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app).get('/api/v1/kitchen/orders').set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/kitchen/orders');
    expect(res.status).toBe(401);
  });

  it('filters by status — status=pending is the "incoming orders" view', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await placeOrder(studentAuth, canteenId, menuItemId);
    await request(app)
      .patch(`/api/v1/kitchen/orders/${order.body.data.order.id}/accept`)
      .set('Authorization', staffAuth);

    const res = await request(app)
      .get('/api/v1/kitchen/orders')
      .query({ status: 'pending' })
      .set('Authorization', staffAuth);

    expect(res.body.meta.total).toBe(1);
  });

  it('filters by orderNumber', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .get('/api/v1/kitchen/orders')
      .query({ orderNumber: order.body.data.order.orderNumber })
      .set('Authorization', staffAuth);

    expect(res.body.meta.total).toBe(1);
  });

  it('filters by pickupToken', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .get('/api/v1/kitchen/orders')
      .query({ pickupToken: order.body.data.order.pickupToken })
      .set('Authorization', staffAuth);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].id).toBe(order.body.data.order.id);
  });

  it('rejects a malformed pickupToken with 400', async () => {
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');

    const res = await request(app)
      .get('/api/v1/kitchen/orders')
      .query({ pickupToken: 'abc' })
      .set('Authorization', staffAuth);

    expect(res.status).toBe(400);
  });

  it('sorts oldest first / newest first', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const first = await placeOrder(studentAuth, canteenId, menuItemId);
    const second = await placeOrder(studentAuth, canteenId, menuItemId);

    const oldestFirst = await request(app)
      .get('/api/v1/kitchen/orders')
      .query({ sortOrder: 'asc' })
      .set('Authorization', staffAuth);
    const newestFirst = await request(app)
      .get('/api/v1/kitchen/orders')
      .query({ sortOrder: 'desc' })
      .set('Authorization', staffAuth);

    expect(oldestFirst.body.data.map((o: { id: string }) => o.id)).toEqual([
      first.body.data.order.id,
      second.body.data.order.id,
    ]);
    expect(newestFirst.body.data.map((o: { id: string }) => o.id)).toEqual([
      second.body.data.order.id,
      first.body.data.order.id,
    ]);
  });
});

describe('GET /kitchen/orders/:id', () => {
  it('returns an order with its items', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .get(`/api/v1/kitchen/orders/${order.body.data.order.id}`)
      .set('Authorization', staffAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.order.items).toHaveLength(1);
  });

  it('forbids a student', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .get(`/api/v1/kitchen/orders/${order.body.data.order.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent order', async () => {
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');

    const res = await request(app)
      .get('/api/v1/kitchen/orders/507f1f77bcf86cd799439011')
      .set('Authorization', staffAuth);

    expect(res.status).toBe(404);
  });
});

describe('Kitchen transition endpoints — full lifecycle', () => {
  async function setupPendingOrder() {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth, user: staff } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    return { staffAuth, staff, studentAuth, id: order.body.data.order.id as string };
  }

  it('accept -> start-preparing -> ready -> complete advances the order and stamps timestamps', async () => {
    const { staffAuth, id } = await setupPendingOrder();

    const accept = await request(app)
      .patch(`/api/v1/kitchen/orders/${id}/accept`)
      .set('Authorization', staffAuth);
    expect(accept.status).toBe(200);
    expect(accept.body.data.order.status).toBe('accepted');
    expect(accept.body.data.order.acceptedAt).not.toBeNull();

    const preparing = await request(app)
      .patch(`/api/v1/kitchen/orders/${id}/start-preparing`)
      .set('Authorization', staffAuth);
    expect(preparing.body.data.order.status).toBe('preparing');

    const ready = await request(app)
      .patch(`/api/v1/kitchen/orders/${id}/ready`)
      .set('Authorization', staffAuth);
    expect(ready.body.data.order.status).toBe('ready');

    const completed = await request(app)
      .patch(`/api/v1/kitchen/orders/${id}/complete`)
      .set('Authorization', staffAuth);
    expect(completed.status).toBe(200);
    expect(completed.body.data.order.status).toBe('completed');
    expect(completed.body.data.order.completedAt).not.toBeNull();
  });

  it('forbids a student from every transition endpoint', async () => {
    const { studentAuth, id } = await setupPendingOrder();

    for (const action of ['accept', 'start-preparing', 'ready', 'complete']) {
      const res = await request(app)
        .patch(`/api/v1/kitchen/orders/${id}/${action}`)
        .set('Authorization', studentAuth);
      expect(res.status).toBe(403);
    }
  });

  it('rejects skipping a stage — same atomic guard as the direct Orders API', async () => {
    const { staffAuth, id } = await setupPendingOrder();

    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${id}/ready`)
      .set('Authorization', staffAuth);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_INVALID_STATUS_TRANSITION');
  });

  it('rejects any transition on a completed order — immutability holds', async () => {
    const { staffAuth, id } = await setupPendingOrder();
    for (const action of ['accept', 'start-preparing', 'ready', 'complete']) {
      await request(app)
        .patch(`/api/v1/kitchen/orders/${id}/${action}`)
        .set('Authorization', staffAuth);
    }

    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${id}/accept`)
      .set('Authorization', staffAuth);

    expect(res.status).toBe(409);
  });

  it('has no cancel capability — kitchen_staff cannot reach the cancel endpoint', async () => {
    const { staffAuth, id } = await setupPendingOrder();

    const res = await request(app)
      .patch(`/api/v1/orders/${id}/cancel`)
      .set('Authorization', staffAuth)
      .send({});

    expect(res.status).toBe(403);
  });

  it('writes the precise per-transition audit action for each step', async () => {
    const { staffAuth, staff, id } = await setupPendingOrder();

    const transitions: Array<[string, AuditAction]> = [
      ['accept', 'order.accepted'],
      ['start-preparing', 'order.preparing'],
      ['ready', 'order.ready'],
      ['complete', 'order.completed'],
    ];
    for (const [action, expectedAction] of transitions) {
      await request(app)
        .patch(`/api/v1/kitchen/orders/${id}/${action}`)
        .set('Authorization', staffAuth);

      const log = await AuditLogModel.findOne({ action: expectedAction, actorId: staff._id });
      expect(log).not.toBeNull();
    }
  });
});
