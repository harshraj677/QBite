import type { Response } from 'express';

import { sendPaginated, sendSuccess } from './api-response';

function mockResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('sendSuccess', () => {
  it('wraps data in the standard envelope with a 200 default', () => {
    const res = mockResponse();

    sendSuccess(res, { id: '1' });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: '1' } });
  });

  it('honors an explicit status code', () => {
    const res = mockResponse();

    sendSuccess(res, { id: '1' }, 201);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('sendPaginated', () => {
  it('includes meta alongside the data array', () => {
    const res = mockResponse();
    const meta = { total: 2, page: 1, limit: 20, hasMore: false };

    sendPaginated(res, [{ id: '1' }, { id: '2' }], meta);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: '1' }, { id: '2' }],
      meta,
    });
  });
});
