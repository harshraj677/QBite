import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '@errors/http-errors';
import { signAccessToken } from './token.util';

const findByIdMock = jest.fn();
jest.mock('@modules/users/users.service', () => ({
  UsersService: jest.fn().mockImplementation(() => ({ findById: findByIdMock })),
}));

// Imported after the mock so auth.middleware.ts's module-level
// `new UsersService()` picks up the mocked class.
import { authenticate, requireRole, type AuthenticatedUser } from './auth.middleware';

function mockReqRes(authHeader?: string) {
  const req = {
    header: (name: string) => (name === 'Authorization' ? authHeader : undefined),
  } as Request;
  const res = {} as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('authenticate', () => {
  beforeEach(() => {
    findByIdMock.mockReset();
  });

  it('rejects a request with no Authorization header', async () => {
    const { req, res, next } = mockReqRes(undefined);

    await authenticate()(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect((next as jest.Mock).mock.calls[0][0].code).toBe('AUTH_TOKEN_MISSING');
  });

  it('rejects a malformed bearer token', async () => {
    const { req, res, next } = mockReqRes('Bearer not-a-real-token');

    await authenticate()(req, res, next);

    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    expect((next as jest.Mock).mock.calls[0][0].code).toBe('AUTH_TOKEN_INVALID');
  });

  it('rejects when the user no longer exists', async () => {
    const { token } = signAccessToken({ sub: 'user-1', role: 'student' });
    findByIdMock.mockResolvedValue(null);
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await authenticate()(req, res, next);

    expect((next as jest.Mock).mock.calls[0][0].code).toBe('AUTH_USER_NOT_FOUND');
  });

  it('rejects when the user is deactivated', async () => {
    const { token } = signAccessToken({ sub: 'user-1', role: 'student' });
    findByIdMock.mockResolvedValue({
      _id: 'user-1',
      role: 'student',
      collegeEmail: 'a@b.edu',
      isActive: false,
    });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await authenticate()(req, res, next);

    expect((next as jest.Mock).mock.calls[0][0].code).toBe('AUTH_USER_NOT_FOUND');
  });

  it('rejects a token issued before the last password change', async () => {
    const { token } = signAccessToken({ sub: 'user-1', role: 'student' });
    findByIdMock.mockResolvedValue({
      _id: 'user-1',
      role: 'student',
      collegeEmail: 'a@b.edu',
      isActive: true,
      passwordChangedAt: new Date(Date.now() + 60_000), // "changed" a minute in the future relative to the token's iat
    });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await authenticate()(req, res, next);

    expect((next as jest.Mock).mock.calls[0][0].code).toBe('AUTH_TOKEN_STALE');
  });

  it('attaches req.user and calls next() with no error on success', async () => {
    const { token } = signAccessToken({ sub: 'user-1', role: 'kitchen_staff' });
    findByIdMock.mockResolvedValue({
      _id: { toString: () => 'user-1' },
      role: 'kitchen_staff',
      collegeEmail: 'staff@college.edu',
      isActive: true,
    });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await authenticate()(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual<AuthenticatedUser>({
      id: 'user-1',
      role: 'kitchen_staff',
      collegeEmail: 'staff@college.edu',
    });
  });
});

describe('requireRole', () => {
  it('rejects when req.user is missing (authenticate did not run)', () => {
    const req = {} as Request;
    const next = jest.fn() as NextFunction;

    requireRole('admin')(req, {} as Response, next);

    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a role not in the allowed list', () => {
    const req = { user: { id: '1', role: 'student', collegeEmail: 'a@b.edu' } } as Request;
    const next = jest.fn() as NextFunction;

    requireRole('admin', 'super_admin')(req, {} as Response, next);

    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    expect((next as jest.Mock).mock.calls[0][0].code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('allows a role in the allowed list', () => {
    const req = { user: { id: '1', role: 'admin', collegeEmail: 'a@b.edu' } } as Request;
    const next = jest.fn() as NextFunction;

    requireRole('admin', 'super_admin')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });
});
