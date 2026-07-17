import request from 'supertest';

import { createApp } from '../../app';

describe('centralized error handling', () => {
  const app = createApp();

  it('returns a standard error envelope for an unmatched route', async () => {
    const res = await request(app).get('/this-route-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: expect.stringContaining('/this-route-does-not-exist'),
        details: null,
      },
    });
  });

  it('never leaks an HTML error page — every error response is JSON', async () => {
    const res = await request(app).get('/nope');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
