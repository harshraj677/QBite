import request from 'supertest';

import { createApp } from '../../app';

describe('security middleware', () => {
  const app = createApp();

  it('sets standard secure headers (helmet)', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('strips NoSQL-operator-style query keys instead of crashing', async () => {
    // This is a regression test for a real bug found while building this
    // phase: express-mongo-sanitize reassigns req.query, which throws
    // under Express 5 ("Cannot set property query of ... which has only
    // a getter"). The custom sanitizer in security.middleware.ts must
    // handle this query without ever 500ing.
    const res = await request(app).get('/health').query({ $where: '1', 'role[$ne]': 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('skips rate limiting under NODE_ENV=test (no RateLimit headers)', async () => {
    // Updated during the IAM phase: createRateLimiter now skips
    // entirely under NODE_ENV=test (see
    // middlewares/rate-limiter.middleware.ts) so integration tests can
    // exercise an endpoint many times without tripping a 429 that has
    // nothing to do with what they're testing. The real
    // limit-exceeded mechanics are covered by
    // rate-limiter.middleware.test.ts instead.
    const res = await request(app).get('/health');

    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });
});
