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

function tokenFor(user: IUser): string {
  return signAccessToken({ sub: user._id.toString(), role: user.role }).token;
}

async function authHeaderFor(
  role: IUser['role'],
  overrides: Partial<Parameters<typeof createTestUser>[0]> = {},
): Promise<{ Authorization: string; user: IUser }> {
  const { user } = await createTestUser({ ...overrides, role });
  return { Authorization: `Bearer ${tokenFor(user)}`, user };
}

describe('GET /users/:id', () => {
  it('returns the public profile for admin', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .get(`/api/v1/users/${student._id.toString()}`)
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      id: student._id.toString(),
      fullName: student.fullName,
      collegeEmail: student.collegeEmail,
      role: 'student',
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('allows super_admin too', async () => {
    const { Authorization: superAdminAuth } = await authHeaderFor('super_admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .get(`/api/v1/users/${student._id.toString()}`)
      .set('Authorization', superAdminAuth);

    expect(res.status).toBe(200);
  });

  it('forbids a student', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { user: other } = await authHeaderFor('student');

    const res = await request(app)
      .get(`/api/v1/users/${other._id.toString()}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });

  it('forbids kitchen_staff', async () => {
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .get(`/api/v1/users/${student._id.toString()}`)
      .set('Authorization', staffAuth);

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/users/507f1f77bcf86cd799439011');
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent user', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');

    const res = await request(app)
      .get('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', adminAuth);

    expect(res.status).toBe(404);
  });

  it('rejects a malformed id with 400', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');

    const res = await request(app).get('/api/v1/users/not-an-id').set('Authorization', adminAuth);

    expect(res.status).toBe(400);
  });

  it('includes isActive (added for the Users Management phase)', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .get(`/api/v1/users/${student._id.toString()}`)
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(true);
    // lastLoginAt is omitted from the JSON body entirely when undefined
    // (a user who has never logged in) — JSON.stringify drops
    // undefined-valued keys, so "field always present" isn't the right
    // assertion here; the field's presence-when-set is exercised by
    // the auth integration tests' post-login /auth/me assertions.
  });
});

describe('GET /users', () => {
  it('returns a paginated list for admin', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    await authHeaderFor('student');
    await authHeaderFor('student');

    const res = await request(app).get('/api/v1/users').set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3); // 2 students + the admin itself
  });

  it('filters by role', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    await authHeaderFor('kitchen_staff');

    const res = await request(app)
      .get('/api/v1/users')
      .query({ role: 'kitchen_staff' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { role: string }) => u.role === 'kitchen_staff')).toBe(true);
  });

  it('searches by name', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    await authHeaderFor('student', { fullName: 'Zubin Mehta' });

    const res = await request(app)
      .get('/api/v1/users')
      .query({ search: 'zubin' })
      .set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.some((u: { fullName: string }) => u.fullName === 'Zubin Mehta')).toBe(
      true,
    );
  });

  it('forbids a student', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');

    const res = await request(app).get('/api/v1/users').set('Authorization', studentAuth);

    expect(res.status).toBe(403);
  });

  it('forbids kitchen_staff', async () => {
    const { Authorization: staffAuth } = await authHeaderFor('kitchen_staff');

    const res = await request(app).get('/api/v1/users').set('Authorization', staffAuth);

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /users/:id/role', () => {
  it('updates the role as admin', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/users/${student._id.toString()}/role`)
      .set('Authorization', adminAuth)
      .send({ role: 'kitchen_staff' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('kitchen_staff');
  });

  it('rejects a self role change with 409', async () => {
    const { Authorization: adminAuth, user: admin } = await authHeaderFor('admin');

    const res = await request(app)
      .patch(`/api/v1/users/${admin._id.toString()}/role`)
      .set('Authorization', adminAuth)
      .send({ role: 'super_admin' });

    expect(res.status).toBe(409);
  });

  it('rejects an admin assigning super_admin with 403', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/users/${student._id.toString()}/role`)
      .set('Authorization', adminAuth)
      .send({ role: 'super_admin' });

    expect(res.status).toBe(403);
  });

  it('allows a super_admin to assign super_admin', async () => {
    const { Authorization: superAdminAuth } = await authHeaderFor('super_admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/users/${student._id.toString()}/role`)
      .set('Authorization', superAdminAuth)
      .send({ role: 'super_admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('super_admin');
  });

  it('allows one super_admin to demote another when a third remains active', async () => {
    await authHeaderFor('super_admin'); // a third, untouched super_admin
    const { Authorization: actingSuperAdminAuth } = await authHeaderFor('super_admin');
    const { user: targetSuperAdmin } = await authHeaderFor('super_admin');

    const res = await request(app)
      .patch(`/api/v1/users/${targetSuperAdmin._id.toString()}/role`)
      .set('Authorization', actingSuperAdminAuth)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });

  // The "last active super_admin" guard (UsersService.updateRole)
  // cannot actually be reached through this endpoint end-to-end: the
  // self-change guard above already requires the acting super_admin to
  // be a *different* account than the target, and that acting account
  // necessarily remains active and counted afterwards — so at least
  // one super_admin always survives a well-formed request. The guard
  // is still correct defense-in-depth (a future bulk-role-change
  // endpoint, or a race between two concurrent requests, could reach
  // the state it protects against) — it's exercised directly, with the
  // repository mocked to report zero remaining, in
  // users.service.test.ts.

  it('forbids a student from changing anyone', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { user: other } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/users/${other._id.toString()}/role`)
      .set('Authorization', studentAuth)
      .send({ role: 'kitchen_staff' });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid role with 400', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/users/${student._id.toString()}/role`)
      .set('Authorization', adminAuth)
      .send({ role: 'teacher' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /users/:id/status', () => {
  it('deactivates a user as admin', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/users/${student._id.toString()}/status`)
      .set('Authorization', adminAuth)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(false);
  });

  it('a deactivated user is rejected by authenticate() on their next request', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { user: student } = await authHeaderFor('student');
    const studentToken = tokenFor(student);

    await request(app)
      .patch(`/api/v1/users/${student._id.toString()}/status`)
      .set('Authorization', adminAuth)
      .send({ isActive: false });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(401);
  });

  it('rejects self-deactivation with 409', async () => {
    const { Authorization: adminAuth, user: admin } = await authHeaderFor('admin');

    const res = await request(app)
      .patch(`/api/v1/users/${admin._id.toString()}/status`)
      .set('Authorization', adminAuth)
      .send({ isActive: false });

    expect(res.status).toBe(409);
  });

  it('allows deactivating an admin-capable account when another remains active', async () => {
    const { Authorization: superAdminAuth } = await authHeaderFor('super_admin');
    const { user: secondAdmin } = await authHeaderFor('admin');

    const res = await request(app)
      .patch(`/api/v1/users/${secondAdmin._id.toString()}/status`)
      .set('Authorization', superAdminAuth)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(false);
  });

  // The "last active admin-capable account" guard (UsersService.setActive)
  // cannot actually be reached through this endpoint end-to-end, for the
  // same structural reason as updateRole's "last super_admin" guard
  // above: the acting admin/super_admin is always a different, still-
  // active account from the target, so it always survives the count.
  // It's exercised directly, with the repository mocked to report zero
  // remaining, in users.service.test.ts.

  it('forbids a student', async () => {
    const { Authorization: studentAuth } = await authHeaderFor('student');
    const { user: other } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/users/${other._id.toString()}/status`)
      .set('Authorization', studentAuth)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  it('rejects a non-boolean isActive with 400', async () => {
    const { Authorization: adminAuth } = await authHeaderFor('admin');
    const { user: student } = await authHeaderFor('student');

    const res = await request(app)
      .patch(`/api/v1/users/${student._id.toString()}/status`)
      .set('Authorization', adminAuth)
      .send({ isActive: 'nope' });

    expect(res.status).toBe(400);
  });
});
