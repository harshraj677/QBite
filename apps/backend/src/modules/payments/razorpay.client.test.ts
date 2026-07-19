import { InternalServerError } from '@errors/http-errors';
import { RazorpayClient } from './razorpay.client';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

const validInput = { amount: 24900, currency: 'INR', receipt: 'QB-2026-AAAAAAAA' };

describe('RazorpayClient.createOrder', () => {
  it('sends Basic auth built from keyId:keySecret and the exact amount/currency/receipt', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'order_test123',
        amount: 24900,
        currency: 'INR',
        status: 'created',
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new RazorpayClient('rzp_test_key', 'rzp_test_secret');
    const result = await client.createOrder(validInput);

    expect(result).toEqual({
      id: 'order_test123',
      amount: 24900,
      currency: 'INR',
      status: 'created',
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('rzp_test_key:rzp_test_secret').toString('base64')}`,
    );
    expect(JSON.parse(options.body)).toMatchObject(validInput);
  });

  it('throws InternalServerError on a non-2xx response, without leaking the raw response body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Authentication failed with detailed internal info',
    }) as unknown as typeof fetch;

    const client = new RazorpayClient('bad-key', 'bad-secret');

    await expect(client.createOrder(validInput)).rejects.toThrow(InternalServerError);
  });

  it('throws InternalServerError when the network request itself fails', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const client = new RazorpayClient('key', 'secret');

    await expect(client.createOrder(validInput)).rejects.toThrow(InternalServerError);
  });
});
