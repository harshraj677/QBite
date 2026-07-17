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

  it('sets a RateLimit header on every response', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});
