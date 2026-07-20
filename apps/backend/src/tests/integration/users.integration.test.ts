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

async function authHeaderFor(role: IUser['role']): Promise<{ Authorization: string; user: IUser }> {
  const { user } = await createTestUser({ role });
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
});
