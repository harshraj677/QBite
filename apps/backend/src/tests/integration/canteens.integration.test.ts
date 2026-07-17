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

/**
 * Mints a valid access token directly (bypassing /auth/login) for a
 * given test user — this module is not testing auth, so there's no
 * need to exercise the full login flow (and its rate limiter) for
 * every RBAC scenario below. Read-only use of auth's public
 * token.util.ts, not a modification to the auth module.
 */
function tokenFor(user: IUser): string {
  return signAccessToken({ sub: user._id.toString(), role: user.role }).token;
}

async function authHeaderFor(role: IUser['role']): Promise<{ Authorization: string; user: IUser }> {
  const { user } = await createTestUser({ role });
  return { Authorization: `Bearer ${tokenFor(user)}`, user };
}

const validCanteenBody = {
  name: 'Main Canteen',
  description: 'The primary campus canteen.',
  location: 'Block A, Ground Floor',
  contactNumber: '+919876543210',
  email: 'main.canteen@college.edu',
  openingTime: '09:00',
  closingTime: '21:00',
};

describe('POST /canteens', () => {
  it('allows an admin to create a canteen', async () => {
    const { Authorization, user } = await authHeaderFor('admin');

    const res = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);

    expect(res.status).toBe(201);
    expect(res.body.data.canteen).toMatchObject({
      name: 'Main Canteen',
      isOpen: true,
      createdBy: user._id.toString(),
    });
  });

  it('allows a super_admin to create a canteen', async () => {
    const { Authorization } = await authHeaderFor('super_admin');

    const res = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);

    expect(res.status).toBe(201);
  });

  it('forbids a student from creating a canteen', async () => {
    const { Authorization } = await authHeaderFor('student');

    const res = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('forbids kitchen_staff from creating a canteen', async () => {
    const { Authorization } = await authHeaderFor('kitchen_staff');

    const res = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/canteens').send(validCanteenBody);

    expect(res.status).toBe(401);
  });

  it('rejects an invalid payload with 400', async () => {
    const { Authorization } = await authHeaderFor('admin');

    const res = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send({ ...validCanteenBody, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects closingTime not after openingTime with 422', async () => {
    const { Authorization } = await authHeaderFor('admin');

    const res = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send({ ...validCanteenBody, openingTime: '21:00', closingTime: '09:00' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CANTEEN_INVALID_TIME_RANGE');
  });

  it('rejects a duplicate canteen name with 409', async () => {
    const { Authorization } = await authHeaderFor('admin');
    await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);

    const res = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send({ ...validCanteenBody, email: 'different@college.edu' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANTEEN_NAME_ALREADY_EXISTS');
  });

  it('rejects a name differing only in case as a duplicate', async () => {
    const { Authorization } = await authHeaderFor('admin');
    await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);

    const res = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send({ ...validCanteenBody, name: 'MAIN CANTEEN', email: 'different@college.edu' });

    expect(res.status).toBe(409);
  });
});

describe('GET /canteens', () => {
  it('allows a student to list canteens', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', adminAuth)
      .send(validCanteenBody);

    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app).get('/api/v1/canteens').set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, limit: 20, hasMore: false });
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/canteens');
    expect(res.status).toBe(401);
  });

  it('paginates and filters by isOpen', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const created = await Promise.all(
      ['Alpha', 'Beta', 'Gamma'].map((name, i) =>
        request(app)
          .post('/api/v1/canteens')
          .set('Authorization', Authorization)
          .send({
            ...validCanteenBody,
            name: `${name} Canteen`,
            email: `${name.toLowerCase()}${i}@college.edu`,
          }),
      ),
    );
    const firstId = created[0].body.data.canteen.id as string;
    await request(app)
      .patch(`/api/v1/canteens/${firstId}/status`)
      .set('Authorization', Authorization);

    const openOnly = await request(app)
      .get('/api/v1/canteens')
      .query({ isOpen: 'true', sortBy: 'name', sortOrder: 'asc' })
      .set('Authorization', Authorization);

    expect(openOnly.body.meta.total).toBe(2);
    expect(openOnly.body.data.map((c: { name: string }) => c.name)).toEqual([
      'Beta Canteen',
      'Gamma Canteen',
    ]);

    const page1 = await request(app)
      .get('/api/v1/canteens')
      .query({ page: 1, limit: 2, sortBy: 'name', sortOrder: 'asc' })
      .set('Authorization', Authorization);

    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta.hasMore).toBe(true);
  });

  it('rejects an out-of-range limit with 400', async () => {
    const { Authorization } = await authHeaderFor('student');

    const res = await request(app)
      .get('/api/v1/canteens')
      .query({ limit: '500' })
      .set('Authorization', Authorization);

    expect(res.status).toBe(400);
  });
});

describe('GET /canteens/:id', () => {
  it('returns the canteen for any authenticated role', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', adminAuth)
      .send(validCanteenBody);

    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app)
      .get(`/api/v1/canteens/${created.body.data.canteen.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.canteen.name).toBe('Main Canteen');
  });

  it('returns 404 for a non-existent id', async () => {
    const { Authorization } = await authHeaderFor('student');

    const res = await request(app)
      .get('/api/v1/canteens/507f1f77bcf86cd799439011')
      .set('Authorization', Authorization);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CANTEEN_NOT_FOUND');
  });

  it('returns 400 for a malformed id', async () => {
    const { Authorization } = await authHeaderFor('student');

    const res = await request(app)
      .get('/api/v1/canteens/not-an-id')
      .set('Authorization', Authorization);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a soft-deleted canteen', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);
    const id = created.body.data.canteen.id as string;
    await request(app).delete(`/api/v1/canteens/${id}`).set('Authorization', Authorization);

    const res = await request(app)
      .get(`/api/v1/canteens/${id}`)
      .set('Authorization', Authorization);

    expect(res.status).toBe(404);
  });
});

describe('PUT /canteens/:id', () => {
  it('allows an admin to update a canteen', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);
    const id = created.body.data.canteen.id as string;

    const res = await request(app)
      .put(`/api/v1/canteens/${id}`)
      .set('Authorization', Authorization)
      .send({ location: 'Block B, First Floor' });

    expect(res.status).toBe(200);
    expect(res.body.data.canteen.location).toBe('Block B, First Floor');
    expect(res.body.data.canteen.name).toBe('Main Canteen');
  });

  it('forbids a student from updating a canteen', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', adminAuth)
      .send(validCanteenBody);

    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app)
      .put(`/api/v1/canteens/${created.body.data.canteen.id}`)
      .set('Authorization', studentAuth)
      .send({ location: 'X' });

    expect(res.status).toBe(403);
  });

  it('rejects an empty update body', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);

    const res = await request(app)
      .put(`/api/v1/canteens/${created.body.data.canteen.id}`)
      .set('Authorization', Authorization)
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects an update that would make the effective time range invalid', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);

    // Only closingTime changes, to before the EXISTING (unchanged) 09:00 opening.
    const res = await request(app)
      .put(`/api/v1/canteens/${created.body.data.canteen.id}`)
      .set('Authorization', Authorization)
      .send({ closingTime: '08:00' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CANTEEN_INVALID_TIME_RANGE');
  });

  it('returns 404 for a non-existent id', async () => {
    const { Authorization } = await authHeaderFor('admin');

    const res = await request(app)
      .put('/api/v1/canteens/507f1f77bcf86cd799439011')
      .set('Authorization', Authorization)
      .send({ location: 'New Location' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /canteens/:id', () => {
  it('allows an admin to soft-delete a canteen', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);
    const id = created.body.data.canteen.id as string;

    const res = await request(app)
      .delete(`/api/v1/canteens/${id}`)
      .set('Authorization', Authorization);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();

    const getRes = await request(app)
      .get(`/api/v1/canteens/${id}`)
      .set('Authorization', Authorization);
    expect(getRes.status).toBe(404);
  });

  it('forbids a student from deleting a canteen', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', adminAuth)
      .send(validCanteenBody);

    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app)
      .delete(`/api/v1/canteens/${created.body.data.canteen.id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });

  it('returns 404 deleting an already-deleted canteen', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);
    const id = created.body.data.canteen.id as string;
    await request(app).delete(`/api/v1/canteens/${id}`).set('Authorization', Authorization);

    const res = await request(app)
      .delete(`/api/v1/canteens/${id}`)
      .set('Authorization', Authorization);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /canteens/:id/status', () => {
  it('allows an admin to toggle open status', async () => {
    const { Authorization } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', Authorization)
      .send(validCanteenBody);
    const id = created.body.data.canteen.id as string;
    expect(created.body.data.canteen.isOpen).toBe(true);

    const closed = await request(app)
      .patch(`/api/v1/canteens/${id}/status`)
      .set('Authorization', Authorization);
    expect(closed.status).toBe(200);
    expect(closed.body.data.canteen.isOpen).toBe(false);

    const reopened = await request(app)
      .patch(`/api/v1/canteens/${id}/status`)
      .set('Authorization', Authorization);
    expect(reopened.body.data.canteen.isOpen).toBe(true);
  });

  it('forbids a student from toggling status', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const created = await request(app)
      .post('/api/v1/canteens')
      .set('Authorization', adminAuth)
      .send(validCanteenBody);

    const { Authorization: studentAuth } = await authHeaderFor('student');
    const res = await request(app)
      .patch(`/api/v1/canteens/${created.body.data.canteen.id}/status`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent id', async () => {
    const { Authorization } = await authHeaderFor('admin');

    const res = await request(app)
      .patch('/api/v1/canteens/507f1f77bcf86cd799439011/status')
      .set('Authorization', Authorization);

    expect(res.status).toBe(404);
  });
});
