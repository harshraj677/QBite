import express from 'express';
import request from 'supertest';

import { createRateLimiter } from './rate-limiter.middleware';

describe('createRateLimiter', () => {
  it('skips rate limiting under NODE_ENV=test, even past the configured max', async () => {
    // The actual "blocks the (max+1)th request" mechanics are
    // express-rate-limit's own well-tested responsibility — what this
    // project adds and needs to verify is the `skip` behavior
    // documented in rate-limiter.middleware.ts (integration tests rely
    // on it to make many requests to the same endpoint without
    // tripping a 429 that has nothing to do with what they're testing).
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 1 }));
    app.get('/probe', (_req, res) => res.status(200).json({ ok: true }));

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app).get('/probe')),
    );

    expect(responses.every((res) => res.status === 200)).toBe(true);
  });
});
