/**
 * `env.ts` reads `process.env` and exports its parsed config at module
 * load time, not via an exported factory — so exercising it under
 * different `process.env` states requires `jest.resetModules()` +
 * re-`require`ing between mutations, rather than calling a function
 * directly. `jest.isolateModules` scopes the module-registry reset to
 * just the callback, so it can't leak into other tests.
 */

const REQUIRED_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017/qbite_test',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
};

function loadEnvWith(overrides: Record<string, string | undefined>): typeof import('./env').env {
  const originalEnv = { ...process.env };
  Object.assign(process.env, REQUIRED_ENV, overrides);

  let loaded: typeof import('./env').env;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = (require('./env') as typeof import('./env')).env;
  });

  process.env = originalEnv;
  return loaded!;
}

describe('env — COLLEGE_EMAIL_DOMAIN', () => {
  // Regression test for the environment-configuration phase's bug:
  // `.string().min(1).optional()` only tolerated the key being
  // *absent*, not present-with-an-empty-value — which is exactly what
  // a real .env file written in .env.example's own style produces
  // (`COLLEGE_EMAIL_DOMAIN=`, no value after the `=`).
  it('does not throw and normalizes to undefined when present but empty (the real .env.example style)', () => {
    const env = loadEnvWith({ COLLEGE_EMAIL_DOMAIN: '' });
    expect(env.collegeEmailDomain).toBeUndefined();
  });

  it('normalizes to undefined when absent entirely', () => {
    const env = loadEnvWith({ COLLEGE_EMAIL_DOMAIN: undefined });
    expect(env.collegeEmailDomain).toBeUndefined();
  });

  it('keeps a real value unchanged', () => {
    const env = loadEnvWith({ COLLEGE_EMAIL_DOMAIN: 'college.edu' });
    expect(env.collegeEmailDomain).toBe('college.edu');
  });
});

describe('env — renamed variables (environment-configuration phase)', () => {
  it('reads MONGODB_URI (not the old MONGO_URI) into env.mongoUri', () => {
    const env = loadEnvWith({ MONGODB_URI: 'mongodb://example.test/qbite' });
    expect(env.mongoUri).toBe('mongodb://example.test/qbite');
  });

  it('reads JWT_ACCESS_EXPIRES_IN/JWT_REFRESH_EXPIRES_IN (not the old *_EXPIRY names)', () => {
    const env = loadEnvWith({ JWT_ACCESS_EXPIRES_IN: '5m', JWT_REFRESH_EXPIRES_IN: '7d' });
    expect(env.jwt.accessExpiry).toBe('5m');
    expect(env.jwt.refreshExpiry).toBe('7d');
  });

  it('reads RATE_LIMIT_MAX_REQUESTS (not the old RATE_LIMIT_MAX)', () => {
    const env = loadEnvWith({ RATE_LIMIT_MAX_REQUESTS: '42' });
    expect(env.rateLimit.max).toBe(42);
  });

  it('reads the new BCRYPT_SALT_ROUNDS and LOG_LEVEL variables, with sane defaults', () => {
    const withDefaults = loadEnvWith({});
    expect(withDefaults.bcryptSaltRounds).toBe(12);
    expect(withDefaults.logLevel).toBe('info');

    const overridden = loadEnvWith({ BCRYPT_SALT_ROUNDS: '10', LOG_LEVEL: 'debug' });
    expect(overridden.bcryptSaltRounds).toBe(10);
    expect(overridden.logLevel).toBe('debug');
  });
});

describe('env — RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET (Payments phase)', () => {
  // Regression test for the same bug class as COLLEGE_EMAIL_DOMAIN
  // above, hit again immediately: the real apps/backend/.env already
  // declared these three present-but-blank (`RAZORPAY_KEY_ID=`) from
  // before any module consumed them, and plain `.default(...)` only
  // fires on `undefined`, not `''` — so adding these with the same
  // `.default(...)` pattern JWT_ACCESS_SECRET uses broke startup
  // immediately (`npx jest` failed with "Too small: expected string
  // to have >=1 characters" for all three) until this transform was
  // added.
  it('falls back to the dev placeholder when present but empty, not just when absent', () => {
    const env = loadEnvWith({
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
      RAZORPAY_WEBHOOK_SECRET: '',
    });
    expect(env.razorpay.keyId).toBe('dev-placeholder-razorpay-key-id');
    expect(env.razorpay.keySecret).toBe('dev-placeholder-razorpay-key-secret');
    expect(env.razorpay.webhookSecret).toBe('dev-placeholder-razorpay-webhook-secret');
  });

  it('falls back to the dev placeholder when absent entirely', () => {
    const env = loadEnvWith({
      RAZORPAY_KEY_ID: undefined,
      RAZORPAY_KEY_SECRET: undefined,
      RAZORPAY_WEBHOOK_SECRET: undefined,
    });
    expect(env.razorpay.keyId).toBe('dev-placeholder-razorpay-key-id');
  });

  it('keeps a real value unchanged', () => {
    const env = loadEnvWith({ RAZORPAY_KEY_ID: 'rzp_test_abc123' });
    expect(env.razorpay.keyId).toBe('rzp_test_abc123');
  });
});
