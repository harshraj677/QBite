import request from 'supertest';
import type { Express } from 'express';

import type { EmailMessage } from '@modules/auth/email.service';

const sentEmails: EmailMessage[] = [];
jest.mock('@modules/auth/email.service', () => ({
  LoggingEmailService: jest.fn().mockImplementation(() => ({
    send: async (message: EmailMessage) => {
      sentEmails.push(message);
    },
  })),
}));

// Imported after the mock (Jest hoists jest.mock above these) so
// every module in the auth chain picks up the capturing email double
// instead of the real LoggingEmailService.
import { createApp } from '../../app';
import { UserModel } from '@modules/users/user.model';
import { ACCOUNT_LOCK_THRESHOLD } from '@modules/auth/auth.constants';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/test-db';
import { createTestUser } from '../helpers/user-factory';

let app: Express;

beforeAll(async () => {
  await connectTestDb();
  app = createApp();
});

afterEach(async () => {
  await clearTestDb();
  sentEmails.length = 0;
});

afterAll(async () => {
  await disconnectTestDb();
});

const validRegisterBody = {
  usn: '1XX21CS001',
  fullName: 'Ada Lovelace',
  collegeEmail: 'ada.lovelace@college.edu',
  phoneNumber: '+919876543210',
  password: 'Str0ng!Passw0rd',
};

function extractOtp(): string {
  const email = sentEmails.find((message) => message.body.includes('verification code is'));
  const match = /verification code is (\d{6})/.exec(email?.body ?? '');
  if (!match) throw new Error('No OTP email captured');
  return match[1];
}

function extractResetToken(): string {
  const email = sentEmails.find((message) => message.body.includes('reset your password'));
  const match = /reset your password: ([0-9a-f]{64})/.exec(email?.body ?? '');
  if (!match) throw new Error('No reset-token email captured');
  return match[1];
}

describe('POST /auth/register', () => {
  it('creates a student and sends a verification OTP', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validRegisterBody);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      usn: '1XX21CS001',
      collegeEmail: 'ada.lovelace@college.edu',
      role: 'student',
      isEmailVerified: false,
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(sentEmails).toHaveLength(1);
  });

  it('rejects an invalid payload with a 400 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegisterBody, password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate college email with 409', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegisterBody);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegisterBody, usn: '1XX21CS999', phoneNumber: '+911111111111' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects a duplicate USN with 409', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegisterBody);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...validRegisterBody,
        collegeEmail: 'someone.else@college.edu',
        phoneNumber: '+911111111111',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USN_ALREADY_REGISTERED');
  });
});

describe('POST /auth/verify-email', () => {
  it('verifies with the correct OTP', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegisterBody);
    const otp = extractOtp();

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ collegeEmail: validRegisterBody.collegeEmail, otp });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isEmailVerified).toBe(true);
  });

  it('rejects a wrong OTP with a generic invalid/expired error', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegisterBody);

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ collegeEmail: validRegisterBody.collegeEmail, otp: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_INVALID');
  });

  it('returns the same generic error for an unregistered email (enumeration resistance)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ collegeEmail: 'nobody@college.edu', otp: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_INVALID');
  });

  it('rejects the OTP once attempts are exhausted, even if a later guess would be correct', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegisterBody);
    const correctOtp = extractOtp();

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ collegeEmail: validRegisterBody.collegeEmail, otp: '000000' });
    }

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ collegeEmail: validRegisterBody.collegeEmail, otp: correctOtp });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_INVALID');
  });
});

describe('POST /auth/login', () => {
  it('logs in with college email + password', async () => {
    const { user, plainPassword } = await createTestUser();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user.id).toBe(user._id.toString());
    expect(res.headers['set-cookie']?.[0]).toContain('qbite_refresh_token=');
  });

  it('logs in with USN + password', async () => {
    const { user, plainPassword } = await createTestUser({ usn: '1XX21CS777' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '1XX21CS777', password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user._id.toString());
  });

  it('rejects an unknown identifier with a generic error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'nobody@college.edu', password: 'x' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unverified account with a specific error', async () => {
    const { user, plainPassword } = await createTestUser({ isEmailVerified: false });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects a disabled account with a specific error', async () => {
    const { user, plainPassword } = await createTestUser({ isActive: false });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('locks the account after repeated failed attempts, independent of a later correct password', async () => {
    const { user, plainPassword } = await createTestUser();

    for (let i = 0; i < ACCOUNT_LOCK_THRESHOLD; i += 1) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: user.collegeEmail, password: 'WrongPassword1!' });
      expect(res.status).toBe(401);
    }

    // Even the CORRECT password is now rejected — account-level lock,
    // not just "still guessing wrong".
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const { user, plainPassword } = await createTestUser();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.data.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(loginRes.body.data.refreshToken);
    expect(res.body.data.accessToken).not.toBe(loginRes.body.data.accessToken);
  });

  it('rejects a missing refresh token with 400', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_MISSING');
  });

  it('rejects an unknown refresh token with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'a'.repeat(64) });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('detects reuse of an already-rotated token and revokes the whole family', async () => {
    const { user, plainPassword } = await createTestUser();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });
    const originalToken = loginRes.body.data.refreshToken as string;

    // Rotate once, legitimately.
    const firstRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalToken });
    expect(firstRefresh.status).toBe(200);
    const rotatedToken = firstRefresh.body.data.refreshToken as string;

    // Reuse of the now-revoked original token — the compromise signal.
    const reuseAttempt = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalToken });
    expect(reuseAttempt.status).toBe(401);
    expect(reuseAttempt.body.error.code).toBe('REFRESH_TOKEN_INVALID');

    // The entire family — including the token that was legitimately
    // rotated to — must now be dead too.
    const rotatedTokenNowDead = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotatedToken });
    expect(rotatedTokenNowDead.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so it can no longer be used', async () => {
    const { user, plainPassword } = await createTestUser();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });
    const refreshToken = loginRes.body.data.refreshToken as string;

    const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('is idempotent — succeeds even with no token / an already-revoked token', async () => {
    const res1 = await request(app).post('/api/v1/auth/logout').send({});
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'a'.repeat(64) });
    expect(res2.status).toBe(200);
  });
});

describe('POST /auth/forgot-password + POST /auth/reset-password', () => {
  it('returns the same generic response whether or not the email is registered', async () => {
    const { user } = await createTestUser();

    const resKnown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ collegeEmail: user.collegeEmail });
    const resUnknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ collegeEmail: 'nobody@college.edu' });

    expect(resKnown.status).toBe(200);
    expect(resUnknown.status).toBe(200);
    expect(resKnown.body.data.message).toBe(resUnknown.body.data.message);
  });

  it('resets the password with a valid token and revokes all existing sessions', async () => {
    const { user, plainPassword } = await createTestUser();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });
    const oldRefreshToken = loginRes.body.data.refreshToken as string;

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ collegeEmail: user.collegeEmail });
    const resetToken = extractResetToken();

    const newPassword = 'N3wStr0ng!Pass';
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword });
    expect(resetRes.status).toBe(200);

    // Old session must be dead.
    const refreshAfterReset = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken });
    expect(refreshAfterReset.status).toBe(401);

    // Old password must no longer work; new password must.
    const loginWithOldPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });
    expect(loginWithOldPassword.status).toBe(401);

    const loginWithNewPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: newPassword });
    expect(loginWithNewPassword.status).toBe(200);
  });

  it('rejects an invalid or already-used reset token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'a'.repeat(64), newPassword: 'Str0ng!Passw0rd' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });
});

describe('GET /auth/me', () => {
  it('returns the authenticated user with a valid access token', async () => {
    const { user, plainPassword } = await createTestUser();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user._id.toString());
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects a missing access token', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_MISSING');
  });

  it('rejects an invalid access token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('rejects a token for a user that no longer exists', async () => {
    const { user, plainPassword } = await createTestUser();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.collegeEmail, password: plainPassword });

    await UserModel.deleteOne({ _id: user._id });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_USER_NOT_FOUND');
  });
});
