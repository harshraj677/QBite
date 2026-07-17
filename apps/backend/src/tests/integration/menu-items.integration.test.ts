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

async function setupCanteenWithCategory(
  Authorization: string,
): Promise<{ canteenId: string; categoryId: string }> {
  // Unique name/email per call — a test may need two independent
  // canteens (e.g. the cross-canteen-mismatch business rule), and
  // canteen names/emails must be unique (canteens.service.ts).
  const unique = Math.random().toString(36).slice(2, 8);
  const canteenRes = await request(app)
    .post('/api/v1/canteens')
    .set('Authorization', Authorization)
    .send({ ...validCanteenBody, name: `Canteen ${unique}`, email: `${unique}@college.edu` });
  const canteenId = canteenRes.body.data.canteen.id as string;

  const categoryRes = await request(app)
    .post(`/api/v1/canteens/${canteenId}/categories`)
    .set('Authorization', Authorization)
    .send({ name: 'Snacks' });
  const categoryId = categoryRes.body.data.category.id as string;

  return { canteenId, categoryId };
}

const validItemBody = {
  name: 'Veg Puff',
  price: 3000,
  preparationTimeMinutes: 5,
  isVeg: true,
};

describe('POST /canteens/:canteenId/menu-items', () => {
  it('allows an admin to create an item', async () => {
    const { Authorization, user } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    expect(res.status).toBe(201);
    expect(res.body.data.item).toMatchObject({
      name: 'Veg Puff',
      canteenId,
      categoryId,
      price: 3000,
      isAvailable: true,
      isFeatured: false,
      createdBy: user._id.toString(),
    });
  });

  it('forbids a student from creating an item', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(adminAuth);
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', studentAuth)
      .send({ ...validItemBody, categoryId });

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .send({ ...validItemBody, categoryId });

    expect(res.status).toBe(401);
  });

  it('rejects a zero price with 400', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId, price: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a zero preparationTimeMinutes with 400', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId, preparationTimeMinutes: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 404 when the category does not exist', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId } = await setupCanteenWithCategory(Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
  });

  it('returns 404 when the category was soft-deleted', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    await request(app)
      .delete(`/api/v1/categories/${categoryId}`)
      .set('Authorization', Authorization);

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
  });

  it('rejects a category belonging to a different canteen with 422', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { categoryId } = await setupCanteenWithCategory(Authorization);
    const otherCanteenRes = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send({ ...validCanteenBody, name: 'Other Canteen', email: 'other@college.edu' });
    const otherCanteenId = otherCanteenRes.body.data.canteen.id as string;

    const res = await request(app)
      .post(`/api/v1/canteens/${otherCanteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MENU_CATEGORY_CANTEEN_MISMATCH');
  });

  it('rejects a duplicate item name within the same category with 409', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    const res = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId, name: 'VEG PUFF' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MENU_ITEM_NAME_ALREADY_EXISTS');
  });

  it('writes a menu_item.created audit log entry', async () => {
    const { Authorization, user } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);

    await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    const log = await AuditLogModel.findOne({ action: 'menu_item.created', actorId: user._id });
    expect(log).not.toBeNull();
  });
});

describe('GET /canteens/:canteenId/menu-items filtering', () => {
  async function seedItems(Authorization: string, canteenId: string, categoryId: string) {
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ name: 'Veg Puff', price: 3000, preparationTimeMinutes: 5, isVeg: true, categoryId });
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({
        name: 'Chicken Puff',
        price: 4000,
        preparationTimeMinutes: 5,
        isVeg: false,
        categoryId,
      });
    await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({
        name: 'Cold Coffee',
        price: 6000,
        preparationTimeMinutes: 3,
        isVeg: true,
        categoryId,
      });
  }

  it('allows a student to list items', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(adminAuth);
    await seedItems(adminAuth, canteenId, categoryId);
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('filters by isVeg', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    await seedItems(Authorization, canteenId, categoryId);

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/menu-items`)
      .query({ isVeg: 'true' })
      .set('Authorization', Authorization);

    expect(res.body.meta.total).toBe(2);
  });

  it('filters by price range', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    await seedItems(Authorization, canteenId, categoryId);

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/menu-items`)
      .query({ priceMin: 3500, priceMax: 5000 })
      .set('Authorization', Authorization);

    expect(res.body.data.map((i: { name: string }) => i.name)).toEqual(['Chicken Puff']);
  });

  it('filters by search', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    await seedItems(Authorization, canteenId, categoryId);

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/menu-items`)
      .query({ search: 'puff' })
      .set('Authorization', Authorization);

    expect(res.body.meta.total).toBe(2);
  });

  it('rejects priceMin greater than priceMax with 400', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId } = await setupCanteenWithCategory(Authorization);

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/menu-items`)
      .query({ priceMin: 500, priceMax: 100 })
      .set('Authorization', Authorization);

    expect(res.status).toBe(400);
  });
});

describe('PUT /menu-items/:id', () => {
  it('allows an admin to update an item', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    const res = await request(app)
      .put(`/api/v1/menu-items/${created.body.data.item.id}`)
      .set('Authorization', Authorization)
      .send({ price: 3500 });

    expect(res.status).toBe(200);
    expect(res.body.data.item.price).toBe(3500);
  });

  it('allows moving an item to another category in the same canteen', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const otherCategory = await request(app)
      .post(`/api/v1/canteens/${canteenId}/categories`)
      .set('Authorization', Authorization)
      .send({ name: 'Beverages' });
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    const res = await request(app)
      .put(`/api/v1/menu-items/${created.body.data.item.id}`)
      .set('Authorization', Authorization)
      .send({ categoryId: otherCategory.body.data.category.id });

    expect(res.status).toBe(200);
    expect(res.body.data.item.categoryId).toBe(otherCategory.body.data.category.id);
  });

  it('rejects moving an item into a category from a different canteen with 422', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const otherSetup = await setupCanteenWithCategory(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    const res = await request(app)
      .put(`/api/v1/menu-items/${created.body.data.item.id}`)
      .set('Authorization', Authorization)
      .send({ categoryId: otherSetup.categoryId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MENU_ITEM_CANTEEN_MISMATCH');
  });

  it('rejects isAvailable in the update body with 400 (reserved for the dedicated endpoint)', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    const res = await request(app)
      .put(`/api/v1/menu-items/${created.body.data.item.id}`)
      .set('Authorization', Authorization)
      .send({ isAvailable: false });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /menu-items/:id', () => {
  it('allows an admin to soft-delete an item', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    const res = await request(app)
      .delete(`/api/v1/menu-items/${created.body.data.item.id}`)
      .set('Authorization', Authorization);
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/v1/menu-items/${created.body.data.item.id}`)
      .set('Authorization', Authorization);
    expect(getRes.status).toBe(404);
  });

  it('forbids a student from deleting', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(adminAuth);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', adminAuth)
      .send({ ...validItemBody, categoryId });
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .delete(`/api/v1/menu-items/${created.body.data.item.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /menu-items/:id/availability', () => {
  it('turns availability off and atomically clears isFeatured', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });
    await request(app)
      .patch(`/api/v1/menu-items/${created.body.data.item.id}/featured`)
      .set('Authorization', Authorization)
      .send({ isFeatured: true });

    const res = await request(app)
      .patch(`/api/v1/menu-items/${created.body.data.item.id}/availability`)
      .set('Authorization', Authorization)
      .send({ isAvailable: false });

    expect(res.status).toBe(200);
    expect(res.body.data.item.isAvailable).toBe(false);
    expect(res.body.data.item.isFeatured).toBe(false);
  });

  it('forbids a student', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(adminAuth);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', adminAuth)
      .send({ ...validItemBody, categoryId });
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/menu-items/${created.body.data.item.id}/availability`)
      .set('Authorization', studentAuth)
      .send({ isAvailable: false });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /menu-items/:id/featured', () => {
  it('rejects featuring an unavailable item with 422', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId, isAvailable: false });

    const res = await request(app)
      .patch(`/api/v1/menu-items/${created.body.data.item.id}/featured`)
      .set('Authorization', Authorization)
      .send({ isFeatured: true });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MENU_ITEM_NOT_AVAILABLE_FOR_FEATURE');
  });

  it('allows featuring an available item', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const created = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, categoryId });

    const res = await request(app)
      .patch(`/api/v1/menu-items/${created.body.data.item.id}/featured`)
      .set('Authorization', Authorization)
      .send({ isFeatured: true });

    expect(res.status).toBe(200);
    expect(res.body.data.item.isFeatured).toBe(true);
  });
});

describe('PATCH /menu-items/:id/reorder', () => {
  it('moves an item to a new position among its category siblings', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const { canteenId, categoryId } = await setupCanteenWithCategory(Authorization);
    const a = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, name: 'Item A', categoryId });
    const b = await request(app)
      .post(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization)
      .send({ ...validItemBody, name: 'Item B', categoryId });

    await request(app)
      .patch(`/api/v1/menu-items/${b.body.data.item.id}/reorder`)
      .set('Authorization', Authorization)
      .send({ displayOrder: 0 });

    const res = await request(app)
      .get(`/api/v1/canteens/${canteenId}/menu-items`)
      .set('Authorization', Authorization);
    expect(res.body.data.map((i: { id: string }) => i.id)).toEqual([
      b.body.data.item.id,
      a.body.data.item.id,
    ]);
  });
});
