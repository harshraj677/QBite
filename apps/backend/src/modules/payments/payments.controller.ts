import type { Request } from 'express';

import { UnauthorizedError } from '@errors/http-errors';
import { sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import type { RequestMeta } from './payments.service';
import { PaymentsService } from './payments.service';
import type {
  CreatePaymentOrderInput,
  PaymentIdParam,
  PaymentOrderIdParam,
  VerifyPaymentInput,
  WebhookEventInput,
} from './payments.validation';

const RAZORPAY_SIGNATURE_HEADER = 'x-razorpay-signature';

function extractMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.header('User-Agent') };
}

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call PaymentsService, shape the response — business logic lives entirely in the service. Same convention as every other module's controller. */
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService = new PaymentsService()) {}

  createOrder = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { orderId } = req.body as CreatePaymentOrderInput;
    const payment = await this.paymentsService.createPaymentOrder(
      orderId,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { payment }, 201);
  });

  verify = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const payment = await this.paymentsService.verifyPayment(
      req.body as VerifyPaymentInput,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { payment });
  });

  /**
   * No `authenticate()` — the caller is Razorpay's own servers, not a
   * QBite user; trust is established entirely by the HMAC signature in
   * the `X-Razorpay-Signature` header (verified against `req.rawBody`,
   * see app.ts's `express.json({ verify })`), not a bearer token.
   * Always responds 200 unless the signature itself is invalid — see
   * `PaymentsService.handleWebhookEvent`'s doc comment for why.
   */
  webhook = catchAsync(async (req, res) => {
    const signature = req.header(RAZORPAY_SIGNATURE_HEADER);
    await this.paymentsService.handleWebhookEvent(
      req.body as WebhookEventInput,
      req.rawBody ?? Buffer.alloc(0),
      signature,
    );
    sendSuccess(res, null);
  });

  getById = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as PaymentIdParam;
    const payment = await this.paymentsService.getPaymentById(id, {
      id: req.user.id,
      role: req.user.role,
    });
    sendSuccess(res, { payment });
  });

  getByOrderId = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { orderId } = req.params as unknown as PaymentOrderIdParam;
    const payment = await this.paymentsService.getPaymentByOrderId(orderId, {
      id: req.user.id,
      role: req.user.role,
    });
    sendSuccess(res, { payment });
  });
}
