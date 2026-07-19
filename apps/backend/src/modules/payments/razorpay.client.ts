import { env } from '@config/env';
import { logger } from '@logging/logger';
import { InternalServerError } from '@errors/http-errors';

const RAZORPAY_API_BASE_URL = 'https://api.razorpay.com/v1';

export interface CreateRazorpayOrderInput {
  /** Integer, paise — see payment.types.ts's doc comment; always sourced from Order.totalAmount, never a client. */
  amount: number;
  currency: string;
  /** Razorpay's own "receipt" field — the order number, so a Razorpay dashboard lookup maps directly back to a QBite order. */
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Thin wrapper over Razorpay's REST API using Node's built-in `fetch`
 * (stable since Node 18; this project runs Node 22) rather than the
 * `razorpay` npm package — the integration surface needed here is one
 * endpoint (create order), and a hand-rolled client keeps the HTTP
 * call, error handling, and auth header construction fully visible
 * and independently mockable in tests (see
 * `tests/integration/payments.integration.test.ts`'s `jest.mock` of
 * this module, the same pattern `auth.integration.test.ts` already
 * uses for `LoggingEmailService`) without pulling in an SDK's own
 * retry/queueing behavior this project doesn't need.
 *
 * Credentials are read from `env.razorpay` (Zod-validated,
 * environment-variables-only — see config/env.ts) by default, never
 * hardcoded; the constructor parameter exists solely so unit tests
 * can inject different values without touching `process.env`.
 */
export class RazorpayClient {
  constructor(
    private readonly keyId: string = env.razorpay.keyId,
    private readonly keySecret: string = env.razorpay.keySecret,
  ) {}

  async createOrder(input: CreateRazorpayOrderInput): Promise<RazorpayOrder> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    let response: Response;
    try {
      response = await fetch(`${RAZORPAY_API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          receipt: input.receipt,
          notes: input.notes,
        }),
      });
    } catch (error) {
      logger.error({ err: error }, 'Razorpay order creation request failed (network error)');
      throw new InternalServerError('Unable to reach the payment gateway. Please try again.');
    }

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        { status: response.status, body },
        'Razorpay order creation failed (non-2xx response)',
      );
      throw new InternalServerError('Unable to create the payment order. Please try again.');
    }

    return (await response.json()) as RazorpayOrder;
  }
}
