import request from 'supertest';

import { createApp } from '../../app';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with the standard success envelope', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'ok' });
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(typeof res.body.data.timestamp).toBe('string');
  });

  it('echoes an inbound X-Request-Id header instead of generating a new one', async () => {
    const res = await request(app).get('/health').set('X-Request-Id', 'test-fixed-id');

    expect(res.headers['x-request-id']).toBe('test-fixed-id');
  });

  it('generates a request ID when none is supplied', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
  });
});
