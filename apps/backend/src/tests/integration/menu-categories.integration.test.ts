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

/** Mints a valid access token directly, bypassing /auth/login — same pattern as canteens.integration.test.ts; this suite isn't testing auth. */
function tokenFor(user: IUser): string {
  return signAccessToken({ sub: user._id.toString(), role: user.role }).token;
}

async function authHeaderFor(role: IUser['role']): Promise<{ Authorization: string; user: IUser }> {
  const { user } = await createTestUser({ role });
  return { Authorization: `Bearer ${tokenFor(user)}`, user };
}

const validCanteenBody = {
  name: 'Main Canteen',
  location: 'Block A, Ground Floor',
  contactNumber: '+919876543210',
  email: 'main.canteen@college.edu',
  openingTime: '09:00',
  closingTime: '21:00',
};

async function createCanteen(Authorization: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/canteens')
    .set('Authorization', Authorization)
    .send(validCanteenBody);
  return res.body.data.canteen.id as string;
}

describe('POST /canteens/:canteenId/categories', () => {
  it('allows an admin to create a category', async () => {
    const { Authorization, user } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks', description: 'Chips, fries, etc.' });

    expect(res.status).toBe(201);
    expect(res.body.data.category).toMatchObject({
      name: 'Snacks',
      canteenId,
      isActive: true,
      displayOrder: 0,
      createdBy: user._id.toString(),
    });
  });

  it('allows a super_admin to create a category', async () => {
    const { Authorization } = await authHeaderFor('super_admin');
    const canteenId = await createCanteen(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    expect(res.status).toBe(201);
  });

  it('forbids a student from creating a category', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const canteenId = await createCanteen(adminAuth);
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', studentAuth)
      .send({ name: 'Snacks' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('forbids kitchen_staff from creating a category', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const canteenId = await createCanteen(adminAuth);
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', staffAuth)
      .send({ name: 'Snacks' });

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .send({ name: 'Snacks' });

    expect(res.status).toBe(401);
  });

  it('rejects an invalid payload with 400', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'S' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a non-existent canteen', async () => {
    const { Authorization } = await authHeaderFor('admin');

    const res = await request(app)
      .post('/api/v1/canteens/507f1f77bcf86cd799439011/categories')
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CANTEEN_NOT_FOUND');
  });

  it('rejects a duplicate category name within the same canteen with 409', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'SNACKS' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MENU_CATEGORY_NAME_ALREADY_EXISTS');
  });

  it('allows the same category name in two different canteens', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId1 = await createCanteen(Authorization);
    const canteenId2 = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send({ ...validCanteenBody, name: 'Second Canteen', email: 'second@college.edu' })
      .then((r) => r.body.data.canteen.id as string);

    await request(app)
      .post(`/api/v1/canteens/${canteenId1}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });
    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId2}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    expect(res.status).toBe(201);
  });

  it('writes a menu_category.created audit log entry', async () => {
    const { Authorization, user } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    const log = await AuditLogModel.findOne({
      action: 'menu_category.created',
      actorId: user._id,
    });
    expect(log).not.toBeNull();
    expect(log?.metadata).toMatchObject({ categoryId: res.body.data.category.id, canteenId });
  });
});

describe('GET /canteens/:canteenId/categories', () => {
  it('allows a student to list categories', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const canteenId = await createCanteen(adminAuth);
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', adminAuth)
      .send({ name: 'Snacks' });

    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('sorts by displayOrder by default', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Beverages', displayOrder: 1 });
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks', displayOrder: 0 });

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization);

    expect(res.body.data.map((c: { name: string }) => c.name)).toEqual(['Snacks', 'Beverages']);
  });

  it('filters by search', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Beverages' });

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/categories`)
      .query({ search: 'snack' })
      .set('Authorization', Authorization);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Snacks');
  });

  it('rejects an unauthenticated request', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);

    const res = await request(app).get(`/api/v1/canteens/${canteenId}/categories`);
    expect(res.status).toBe(401);
  });
});

describe('GET /categories/:id', () => {
  it('returns a category by id', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    const res = await request(app)
      .get(`/api/v1/categories/${created.body.data.category.id}`)
      .set('Authorization', Authorization);

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe('Snacks');
  });

  it('returns 404 for a non-existent category', async () => {
    const { Authorization } = await authHeaderFor('admin');

    const res = await request(app)
      .get('/api/v1/categories/507f1f77bcf86cd799439011')
      .set('Authorization', Authorization);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
  });

  it('rejects a malformed id with 400', async () => {
    const { Authorization } = await authHeaderFor('admin');

    const res = await request(app)
      .get('/api/v1/categories/not-an-id')
      .set('Authorization', Authorization);

    expect(res.status).toBe(400);
  });
});

describe('PUT /categories/:id', () => {
  it('allows an admin to update a category', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    const res = await request(app)
      .put(`/api/v1/categories/${created.body.data.category.id}`)
      .set('Authorization', Authorization)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.category.isActive).toBe(false);
  });

  it('forbids a student from updating', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const canteenId = await createCanteen(adminAuth);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', adminAuth)
      .send({ name: 'Snacks' });
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .put(`/api/v1/categories/${created.body.data.category.id}`)
      .set('Authorization', studentAuth)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  it('rejects displayOrder in the update body with 400', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    const res = await request(app)
      .put(`/api/v1/categories/${created.body.data.category.id}`)
      .set('Authorization', Authorization)
      .send({ displayOrder: 5 });

    expect(res.status).toBe(400);
  });

  it('rejects renaming to a name already used in the same canteen', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });
    const beverages = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Beverages' });

    const res = await request(app)
      .put(`/api/v1/categories/${beverages.body.data.category.id}`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /categories/:id', () => {
  it('allows an admin to delete a category with no items', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });

    const res = await request(app)
      .delete(`/api/v1/categories/${created.body.data.category.id}`)
      .set('Authorization', Authorization);

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/v1/categories/${created.body.data.category.id}`)
      .set('Authorization', Authorization);
    expect(getRes.status).toBe(404);
  });

  it('rejects deleting a category with active items when force is not set', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    const category = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({
        categoryId: category.body.data.category.id,
        name: 'Veg Puff',
        price: 3000,
        preparationTimeMinutes: 5,
        isVeg: true,
      });

    const res = await request(app)
      .delete(`/api/v1/categories/${category.body.data.category.id}`)
      .set('Authorization', Authorization);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MENU_CATEGORY_HAS_ACTIVE_ITEMS');
  });

  it('cascades to soft-delete active items when force=true', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    const category = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });
    const item = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({
        categoryId: category.body.data.category.id,
        name: 'Veg Puff',
        price: 3000,
        preparationTimeMinutes: 5,
        isVeg: true,
      });

    const res = await request(app)
      .delete(`/api/v1/categories/${category.body.data.category.id}`)
      .query({ force: 'true' })
      .set('Authorization', Authorization);

    expect(res.status).toBe(200);

    const itemRes = await request(app)
      .get(`/api/v1/menu-items/${item.body.data.item.id}`)
      .set('Authorization', Authorization);
    expect(itemRes.status).toBe(404);
  });

  it('forbids a student from deleting', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const canteenId = await createCanteen(adminAuth);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', adminAuth)
      .send({ name: 'Snacks' });
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .delete(`/api/v1/categories/${created.body.data.category.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /categories/:id/reorder', () => {
  it('moves a category to a new position among its siblings', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const canteenId = await createCanteen(Authorization);
    const snacks = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Snacks' });
    const beverages = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Beverages' });

    await request(app)
      .patch(`/api/v1/categories/${beverages.body.data.category.id}/reorder`)
      .set('Authorization', Authorization)
      .send({ displayOrder: 0 });

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([
      beverages.body.data.category.id,
      snacks.body.data.category.id,
    ]);
  });

  it('forbids a student from reordering', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const canteenId = await createCanteen(adminAuth);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', adminAuth)
      .send({ name: 'Snacks' });
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/categories/${created.body.data.category.id}/reorder`)
      .set('Authorization', studentAuth)
      .send({ displayOrder: 0 });

    expect(res.status).toBe(403);
  });
});
