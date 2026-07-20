import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '../../app';
import { signAccessToken } from '@modules/auth/token.util';
import { OrderModel } from '@modules/orders/order.model';
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
  quantity = 1,
) {
  return request(app)
    .post(`/api/v1/canteens/${canteenId}/orders`)
    .set('Authorization', studentAuth)
    .send({ items: [{ menuItemId, quantity }], paymentMethod: 'online' });
}

/**
 * Marks an order paid (and optionally backdates it) directly against
 * the database rather than driving the full Razorpay HMAC flow —
 * that flow is already fully covered by payments.integration.test.ts;
 * this suite's subject is Analytics' aggregation correctness, not
 * Payments' correctness. Backdating is required for day/month/
 * time-series bucket tests, since a test run can't wait real days.
 */
async function markPaid(
  orderId: string,
  overrides: { createdAt?: Date; acceptedAt?: Date; readyAt?: Date } = {},
): Promise<void> {
  await OrderModel.updateOne({ _id: orderId }, { $set: { paymentStatus: 'paid', ...overrides } });
}

describe('GET /analytics/dashboard', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/analytics/dashboard');
    expect(res.status).toBe(401);
  });

  it('forbids a student', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', studentAuth);
    expect(res.status).toBe(403);
  });

  it('forbids kitchen_staff', async () => {
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', staffAuth);
    expect(res.status).toBe(403);
  });

  it('returns real totals computed from live data', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId, price } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await markPaid(order.body.data.order.id);

    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.revenue.total).toBe(price);
    expect(res.body.data.revenue.today).toBe(price);
    expect(res.body.data.orders.total).toBe(1);
    expect(res.body.data.orders.byStatus.pending).toBe(1);
    expect(res.body.data.users.totalStudents).toBeGreaterThanOrEqual(1);
    expect(res.body.data.canteens.total).toBe(1);
    expect(res.body.data.menuItems.total).toBe(1);
  });

  it('does not count a pending (unpaid) order in revenue', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    await placeOrder(studentAuth, canteenId, menuItemId);

    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', adminAuth);

    expect(res.body.data.revenue.total).toBe(0);
  });
});

describe('GET /analytics/revenue', () => {
  it('forbids a non-admin role', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .set('Authorization', studentAuth);
    expect(res.status).toBe(403);
  });

  it('rejects filter=custom without startDate/endDate', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .query({ filter: 'custom' })
      .set('Authorization', adminAuth);
    expect(res.status).toBe(400);
  });

  it('computes totalRevenue/orderCount/averageOrderValue for the resolved window', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId, price } = await setupCanteenWithItem(adminAuth);
    const orderA = await placeOrder(studentAuth, canteenId, menuItemId);
    await markPaid(orderA.body.data.order.id);
    const orderB = await placeOrder(studentAuth, canteenId, menuItemId, 2);
    await markPaid(orderB.body.data.order.id);

    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .query({ filter: 'today' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.totalRevenue).toBe(price + price * 2);
    expect(res.body.data.totalOrderCount).toBe(2);
    expect(res.body.data.averageOrderValue).toBe(Math.round((price + price * 2) / 2));
  });

  it('buckets revenue by month when granularity=month', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await markPaid(order.body.data.order.id);

    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .query({ filter: 'currentMonth', granularity: 'month' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.buckets).toHaveLength(1);
    expect(res.body.data.buckets[0].orderCount).toBe(1);
  });

  it('supports filter=custom with explicit startDate/endDate', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .query({ filter: 'custom', startDate: '2020-01-01', endDate: '2020-01-31' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.totalRevenue).toBe(0);
  });
});

describe('GET /analytics/orders', () => {
  it('forbids a non-admin role', async () => {
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const res = await request(app).get('/api/v1/analytics/orders').set('Authorization', staffAuth);
    expect(res.status).toBe(403);
  });

  it('reports byStatus and a completionRate consistent with it', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const completedOrder = await placeOrder(studentAuth, canteenId, menuItemId);
    const id = completedOrder.body.data.order.id as string;
    for (const status of ['accepted', 'preparing', 'ready', 'completed']) {
      await request(app)
        .patch(`/api/v1/orders/${id}/status`)
        .set('Authorization', staffAuth)
        .send({ status });
    }
    await placeOrder(studentAuth, canteenId, menuItemId); // stays pending

    const res = await request(app)
      .get('/api/v1/analytics/orders')
      .query({ filter: 'today' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.byStatus.completed).toBe(1);
    expect(res.body.data.byStatus.pending).toBe(1);
    expect(res.body.data.completionRate).toBe(50);
  });

  it('computes averagePreparationTimeMinutes from acceptedAt/readyAt', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await OrderModel.updateOne(
      { _id: order.body.data.order.id },
      {
        $set: {
          acceptedAt: new Date('2026-01-01T10:00:00Z'),
          readyAt: new Date('2026-01-01T10:20:00Z'),
        },
      },
    );

    const res = await request(app)
      .get('/api/v1/analytics/orders')
      .query({ filter: 'today' })
      .set('Authorization', adminAuth);

    expect(res.body.data.averagePreparationTimeMinutes).toBe(20);
  });
});

describe('GET /analytics/menu', () => {
  it('forbids a non-admin role', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app).get('/api/v1/analytics/menu').set('Authorization', studentAuth);
    expect(res.status).toBe(403);
  });

  it('ranks items by quantitySold and rolls categories up correctly', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth, {
      name: 'Popular Item',
    });
    await placeOrder(studentAuth, canteenId, menuItemId, 5);

    const res = await request(app)
      .get('/api/v1/analytics/menu')
      .query({ filter: 'today' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.topSellingItems[0]).toMatchObject({
      itemName: 'Popular Item',
      quantitySold: 5,
    });
    expect(res.body.data.revenuePerCategory[0]).toMatchObject({ categoryName: 'Snacks' });
  });

  it('excludes items belonging to a cancelled order', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await request(app)
      .patch(`/api/v1/orders/${order.body.data.order.id}/cancel`)
      .set('Authorization', studentAuth)
      .send({});

    const res = await request(app)
      .get('/api/v1/analytics/menu')
      .query({ filter: 'today' })
      .set('Authorization', adminAuth);

    expect(res.body.data.topSellingItems).toEqual([]);
  });

  it('respects the limit query param', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, categoryId } = await setupCanteenWithItem(adminAuth, { name: 'Item A' });
    const itemBRes = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', adminAuth)
      .send({ categoryId, name: 'Item B', price: 2000, preparationTimeMinutes: 5, isVeg: true });
    const itemBId = itemBRes.body.data.item.id as string;
    await placeOrder(studentAuth, canteenId, itemBId, 1);

    const res = await request(app)
      .get('/api/v1/analytics/menu')
      .query({ filter: 'today', limit: 1 })
      .set('Authorization', adminAuth);

    expect(res.body.data.topSellingItems).toHaveLength(1);
  });
});

describe('GET /analytics/canteens', () => {
  it('forbids a non-admin role', async () => {
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const res = await request(app)
      .get('/api/v1/analytics/canteens')
      .set('Authorization', staffAuth);
    expect(res.status).toBe(403);
  });

  it('resolves canteen names alongside revenue/order counts', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { canteenId, menuItemId, price } = await setupCanteenWithItem(adminAuth);
    const order = await placeOrder(studentAuth, canteenId, menuItemId);
    await markPaid(order.body.data.order.id);

    const res = await request(app)
      .get('/api/v1/analytics/canteens')
      .query({ filter: 'today' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.byCanteen[0]).toMatchObject({ canteenId, revenue: price, orderCount: 1 });
    expect(res.body.data.byCanteen[0].canteenName).toEqual(expect.any(String));
    expect(res.body.data.topPerforming[0].canteenId).toBe(canteenId);
  });
});

describe('GET /analytics/users', () => {
  it('forbids a non-admin role', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app).get('/api/v1/analytics/users').set('Authorization', studentAuth);
    expect(res.status).toBe(403);
  });

  it('counts newUsers registered in the resolved window', async () => {
    // Both accounts (admin + the explicit student) are created "now",
    // via createTestUser's own model-level timestamp — not backdated,
    // since Mongoose's `timestamps: true` schema option strips a
    // manually-`$set` `createdAt` from a raw `updateOne` (the same
    // behavior orders.repository.test.ts already works around).
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    await createTestUser({ role: 'student' });

    const today = await request(app)
      .get('/api/v1/analytics/users')
      .query({ filter: 'today' })
      .set('Authorization', adminAuth);
    const past = await request(app)
      .get('/api/v1/analytics/users')
      .query({ filter: 'custom', startDate: '2020-01-01', endDate: '2020-01-31' })
      .set('Authorization', adminAuth);

    expect(today.status).toBe(200);
    expect(today.body.data.newUsers).toBe(2); // the admin + the explicit student, both created "now"
    expect(past.body.data.newUsers).toBe(0);
  });

  it('reports activeUsers/repeatCustomers/topCustomers from real order history', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { Authorization: studentAuth, user: student } = await authHeaderFor('student');
    const { canteenId, menuItemId } = await setupCanteenWithItem(adminAuth);
    const orderA = await placeOrder(studentAuth, canteenId, menuItemId);
    await markPaid(orderA.body.data.order.id);
    const orderB = await placeOrder(studentAuth, canteenId, menuItemId);
    await markPaid(orderB.body.data.order.id);

    const res = await request(app)
      .get('/api/v1/analytics/users')
      .query({ filter: 'today' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.activeUsers).toBe(1);
    expect(res.body.data.repeatCustomers).toBe(1);
    expect(res.body.data.topCustomers[0]).toMatchObject({
      userId: student._id.toString(),
      fullName: student.fullName,
      orderCount: 2,
    });
  });
});
