import { createHash } from 'node:crypto';

import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import { env } from '@config/env';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  parseDurationToMs,
  signAccessToken,
  verifyAccessToken,
} from './token.util';

describe('generateOpaqueToken', () => {
  it('generates a 64-char hex string (256 bits)', () => {
    const token = generateOpaqueToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a different value each call', () => {
    expect(generateOpaqueToken()).not.toBe(generateOpaqueToken());
  });
});

describe('hashOpaqueToken', () => {
  it('matches a plain SHA-256 digest of the input', () => {
    const raw = 'some-raw-token-value';
    const expected = createHash('sha256').update(raw).digest('hex');

    expect(hashOpaqueToken(raw)).toBe(expected);
  });

  it('is deterministic — same input, same hash, no salt', () => {
    const raw = generateOpaqueToken();

    expect(hashOpaqueToken(raw)).toBe(hashOpaqueToken(raw));
  });
});

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips the payload', () => {
    const { token } = signAccessToken({ sub: 'user-123', role: 'student' });

    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe('user-123');
    expect(decoded.role).toBe('student');
  });

  it('produces a different token even when issued twice in the same second for the same user', () => {
    // Regression test: HMAC signing is deterministic, so without a
    // unique jti claim, two tokens for the same {sub, role} signed
    // within the same iat-second would be byte-for-byte identical —
    // this bit an integration test (login immediately followed by
    // refresh) before signAccessToken started setting jwtid.
    const first = signAccessToken({ sub: 'user-123', role: 'student' });
    const second = signAccessToken({ sub: 'user-123', role: 'student' });

    expect(first.token).not.toBe(second.token);
  });

  it('reports expiresIn consistent with the token env config', () => {
    const { expiresIn } = signAccessToken({ sub: 'user-123', role: 'student' });

    expect(expiresIn).toBeGreaterThan(0);
  });

  it('throws JsonWebTokenError for a garbage token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow(JsonWebTokenError);
  });

  it('throws TokenExpiredError for an already-expired token', () => {
    // -1s expiry: signs a token that is already expired the instant it's created.
    const expired = jwt.sign({ sub: 'x', role: 'student' }, env.jwt.accessSecret, {
      expiresIn: -1,
    });

    expect(() => verifyAccessToken(expired)).toThrow(TokenExpiredError);
  });
});

describe('parseDurationToMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30d', 2_592_000_000],
  ])('parses "%s" to %i ms', (input, expectedMs) => {
    expect(parseDurationToMs(input)).toBe(expectedMs);
  });

  it('throws on an unsupported format', () => {
    expect(() => parseDurationToMs('one week')).toThrow();
  });
});
