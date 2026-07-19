import { Types } from 'mongoose';

import { env } from '@config/env';
import { logger } from '@logging/logger';
import { AuditLogService } from '@modules/audit/audit-log.service';
import type { AuditAction } from '@modules/audit/audit-log.types';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { OrdersService } from '@modules/orders/orders.service';
import type { UserRole } from '@modules/users/user.types';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '@errors/http-errors';
import { DEFAULT_CURRENCY, PAYMENT_FORWARD_TRANSITIONS } from './payments.constants';
import { PaymentsRepository } from './payments.repository';
import type { IPayment, PaymentStatus, PublicPaymentDto } from './payment.types';
import { toPublicPaymentDto } from './payment.types';
import { RazorpayClient } from './razorpay.client';
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay-signature.util';
import type { VerifyPaymentInput, WebhookEventInput } from './payments.validation';

export interface AuditActor {
  id: string;
  role: UserRole;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/** Direct status->action mapping, same convention as orders.service.ts's statusUpdateAuditAction. Only ever called for SUCCESS/FAILED/REFUNDED — a mere CREATED->PENDING transition isn't audited (see transitionPaymentStatus). */
function paymentAuditAction(status: PaymentStatus): AuditAction {
  switch (status) {
    case 'SUCCESS':
      return 'payment.success';
    case 'FAILED':
      return 'payment.failed';
    case 'REFUNDED':
      return 'payment.refunded';
    default:
      throw new Error(`No audit action mapped for payment status "${status}".`);
  }
}

interface RazorpayPaymentEntity {
  paymentId: string;
  orderId: string;
  method?: string;
  errorDescription?: string;
}

/** Defensive extraction from Razorpay's loosely-typed webhook payload — see payments.validation.ts's webhookEventSchema doc comment for why this isn't a Zod schema. Returns null (never throws) on any unexpected shape; the caller logs and treats that as an ignorable event, not a fatal error. */
function extractPaymentEntity(payload: Record<string, unknown>): RazorpayPaymentEntity | null {
  const payment = payload.payment;
  if (!payment || typeof payment !== 'object') return null;
  const entity = (payment as Record<string, unknown>).entity;
  if (!entity || typeof entity !== 'object') return null;
  const e = entity as Record<string, unknown>;
  if (typeof e.id !== 'string' || typeof e.order_id !== 'string') return null;
  return {
    paymentId: e.id,
    orderId: e.order_id,
    method: typeof e.method === 'string' ? e.method : undefined,
    errorDescription: typeof e.error_description === 'string' ? e.error_description : undefined,
  };
}

interface RazorpayRefundEntity {
  paymentId: string;
  amount: number;
}

function extractRefundEntity(payload: Record<string, unknown>): RazorpayRefundEntity | null {
  const refund = payload.refund;
  if (!refund || typeof refund !== 'object') return null;
  const entity = (refund as Record<string, unknown>).entity;
  if (!entity || typeof entity !== 'object') return null;
  const e = entity as Record<string, unknown>;
  if (typeof e.payment_id !== 'string' || typeof e.amount !== 'number') return null;
  return { paymentId: e.payment_id, amount: e.amount };
}

/**
 * Business rules for `payments`. Depends on its own repository,
 * `OrdersService`/`NotificationsService` (cross-module, via their
 * public services — never a repository), `AuditLogService`, and
 * `RazorpayClient` (this module's own external-gateway boundary).
 *
 * No dependency back from `orders/` or `notifications/` — both of
 * those depend on primitives, never on anything from `payments/`,
 * matching the same one-directional-dependency shape `orders/` -> `notifications/`
 * already established.
 */
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository = new PaymentsRepository(),
    private readonly ordersService: OrdersService = new OrdersService(),
    private readonly notificationsService: NotificationsService = new NotificationsService(),
    private readonly auditLogService: AuditLogService = new AuditLogService(),
    private readonly razorpayClient: RazorpayClient = new RazorpayClient(),
  ) {}

  /**
   * `OrdersService.getOrderById` already enforces "a student may only
   * access their own order" — reused here rather than duplicated, so
   * "only the order owner can initiate payment" is the exact same
   * ownership check Orders itself uses, not a second implementation
   * of it.
   */
  async createPaymentOrder(
    orderId: string,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicPaymentDto> {
    const order = await this.ordersService.getOrderById(orderId, actor);

    if (order.paymentStatus === 'paid') {
      throw new ConflictError('PAYMENT_ALREADY_COMPLETED', 'This order has already been paid for.');
    }
    // Defense in depth beyond the order.paymentStatus check above —
    // the model's own partial unique index is the real guarantee (see
    // payment.model.ts); this is the fast-path/better-error-message
    // optimization, same pattern as CanteensService's nameKey check.
    if (await this.paymentsRepository.existsSuccessForOrder(orderId)) {
      throw new ConflictError('PAYMENT_ALREADY_COMPLETED', 'This order has already been paid for.');
    }

    // Amount is always the server-computed Order total — never a
    // client-supplied value (createPaymentOrderSchema has no `amount`
    // field for a client to even send).
    const razorpayOrder = await this.razorpayClient.createOrder({
      amount: order.totalAmount,
      currency: DEFAULT_CURRENCY,
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber },
    });

    const payment = await this.paymentsRepository.create({
      orderId,
      userId: actor.id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.totalAmount,
      currency: DEFAULT_CURRENCY,
    });

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'payment.created',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        paymentId: payment._id.toString(),
        orderId,
        razorpayOrderId: razorpayOrder.id,
        amount: order.totalAmount,
      },
    });

    return toPublicPaymentDto(payment);
  }

  /**
   * Idempotent — a payment already resolved to SUCCESS or FAILED is
   * returned as-is, with no re-verification and no repeated side
   * effects, satisfying "duplicate verification must be idempotent"
   * for the exact same reason a second webhook delivery is (see
   * `transitionPaymentStatus`).
   */
  async verifyPayment(
    input: VerifyPaymentInput,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicPaymentDto> {
    const payment = await this.paymentsRepository.findByRazorpayOrderId(input.razorpayOrderId);
    if (!payment) {
      throw new NotFoundError('PAYMENT_NOT_FOUND', 'Payment not found.');
    }
    if (payment.userId.toString() !== actor.id) {
      throw new ForbiddenError('PAYMENT_ACCESS_DENIED', 'You do not have access to this payment.');
    }

    if (payment.status === 'SUCCESS' || payment.status === 'FAILED') {
      return toPublicPaymentDto(payment);
    }

    const isValid = verifyPaymentSignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
      env.razorpay.keySecret,
    );

    if (!isValid) {
      await this.transitionPaymentStatus(
        payment,
        'FAILED',
        {
          razorpayPaymentId: input.razorpayPaymentId,
          razorpaySignature: input.razorpaySignature,
          failureReason: 'Signature verification failed',
        },
        actor,
        meta,
      );
      throw new UnprocessableEntityError(
        'PAYMENT_SIGNATURE_INVALID',
        'Payment signature verification failed.',
      );
    }

    const updated = await this.transitionPaymentStatus(
      payment,
      'SUCCESS',
      { razorpayPaymentId: input.razorpayPaymentId, razorpaySignature: input.razorpaySignature },
      actor,
      meta,
    );

    return toPublicPaymentDto(updated);
  }

  async getPaymentById(id: string, actor: AuditActor): Promise<PublicPaymentDto> {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new NotFoundError('PAYMENT_NOT_FOUND', 'Payment not found.');
    }
    if (actor.role === 'student' && payment.userId.toString() !== actor.id) {
      throw new ForbiddenError('PAYMENT_ACCESS_DENIED', 'You do not have access to this payment.');
    }
    return toPublicPaymentDto(payment);
  }

  /** Ownership enforced via OrdersService.getOrderById first — same reused-check rationale as createPaymentOrder. Returns the SUCCESS payment if one exists, else the most recent attempt (see PaymentsRepository.findRelevantByOrderId). */
  async getPaymentByOrderId(orderId: string, actor: AuditActor): Promise<PublicPaymentDto> {
    await this.ordersService.getOrderById(orderId, actor);

    const payment = await this.paymentsRepository.findRelevantByOrderId(orderId);
    if (!payment) {
      throw new NotFoundError('PAYMENT_NOT_FOUND', 'No payment found for this order.');
    }
    return toPublicPaymentDto(payment);
  }

  /**
   * Server-to-server — no authenticated actor, authenticated instead
   * by the HMAC signature (see razorpay-signature.util.ts). Only a
   * signature failure ever produces a non-2xx response; every other
   * failure mode (unrecognized event, payload we can't correlate to a
   * known payment, an unexpected processing error) is caught, logged,
   * and still resolves normally — Razorpay retries aggressively on
   * non-2xx, and none of those failure modes would be fixed by a
   * retry, so surfacing them as errors would just produce a retry
   * storm for something that can't self-heal. This is the opposite
   * trade-off from `verifyPayment` above, which *does* let errors
   * propagate to the student-facing caller — see that method's
   * ownership/signature checks for the contrast.
   */
  async handleWebhookEvent(
    event: WebhookEventInput,
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<void> {
    if (!signature || !verifyWebhookSignature(rawBody, signature, env.razorpay.webhookSecret)) {
      throw new UnauthorizedError('WEBHOOK_SIGNATURE_INVALID', 'Invalid webhook signature.');
    }

    try {
      switch (event.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(event.payload);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(event.payload);
          break;
        case 'refund.processed':
          await this.handleRefundProcessed(event.payload);
          break;
        default:
          logger.info({ event: event.event }, 'Ignored unrecognized Razorpay webhook event');
      }
    } catch (error) {
      logger.error({ err: error, event: event.event }, 'Failed to process Razorpay webhook event');
    }
  }

  private async handlePaymentCaptured(payload: Record<string, unknown>): Promise<void> {
    const entity = extractPaymentEntity(payload);
    if (!entity) {
      logger.warn(
        { payload },
        'payment.captured webhook missing expected payment entity — ignored',
      );
      return;
    }
    const payment = await this.paymentsRepository.findByRazorpayOrderId(entity.orderId);
    if (!payment) {
      logger.warn(
        { razorpayOrderId: entity.orderId },
        'payment.captured webhook for an unrecognized payment — ignored',
      );
      return;
    }
    await this.transitionPaymentStatus(
      payment,
      'SUCCESS',
      { razorpayPaymentId: entity.paymentId, paymentMethod: entity.method },
      undefined,
      {},
    );
  }

  private async handlePaymentFailed(payload: Record<string, unknown>): Promise<void> {
    const entity = extractPaymentEntity(payload);
    if (!entity) {
      logger.warn({ payload }, 'payment.failed webhook missing expected payment entity — ignored');
      return;
    }
    const payment = await this.paymentsRepository.findByRazorpayOrderId(entity.orderId);
    if (!payment) {
      logger.warn(
        { razorpayOrderId: entity.orderId },
        'payment.failed webhook for an unrecognized payment — ignored',
      );
      return;
    }
    await this.transitionPaymentStatus(
      payment,
      'FAILED',
      {
        razorpayPaymentId: entity.paymentId,
        failureReason: entity.errorDescription ?? 'Payment failed',
      },
      undefined,
      {},
    );
  }

  private async handleRefundProcessed(payload: Record<string, unknown>): Promise<void> {
    const entity = extractRefundEntity(payload);
    if (!entity) {
      logger.warn({ payload }, 'refund.processed webhook missing expected refund entity — ignored');
      return;
    }
    const payment = await this.paymentsRepository.findByRazorpayPaymentId(entity.paymentId);
    if (!payment) {
      logger.warn(
        { razorpayPaymentId: entity.paymentId },
        'refund.processed webhook for an unrecognized payment — ignored',
      );
      return;
    }
    await this.transitionPaymentStatus(
      payment,
      'REFUNDED',
      { refundedAmount: entity.amount },
      undefined,
      {},
    );
  }

  /**
   * The one place every payment state change funnels through,
   * regardless of whether it came from the synchronous
   * `POST /payments/verify` flow or an asynchronous webhook — the
   * "don't duplicate business logic" principle applied *within* this
   * module the same way the Kitchen phase applied it *between*
   * modules. Idempotent (already-at-target-status is a silent
   * success) and self-healing against invalid transitions (logged and
   * ignored, never thrown) — both are required for "duplicate
   * verification must be idempotent" / "webhook retries must be
   * idempotent" to hold regardless of which entry point a retry
   * arrives through.
   */
  private async transitionPaymentStatus(
    payment: IPayment,
    toStatus: PaymentStatus,
    extraFields: Record<string, unknown>,
    actor: AuditActor | undefined,
    meta: RequestMeta,
  ): Promise<IPayment> {
    if (payment.status === toStatus) {
      return payment;
    }
    if (!PAYMENT_FORWARD_TRANSITIONS[payment.status].includes(toStatus)) {
      logger.warn(
        { paymentId: payment._id.toString(), from: payment.status, to: toStatus },
        'Ignored invalid payment status transition',
      );
      return payment;
    }

    const updated = await this.paymentsRepository.updateStatus(
      payment._id,
      payment.status,
      toStatus,
      extraFields,
    );
    if (!updated) {
      // Raced with a concurrent transition (e.g. a webhook and
      // /verify resolving the same payment near-simultaneously) —
      // return the current state idempotently rather than erroring.
      const current = await this.paymentsRepository.findById(payment._id);
      return current ?? payment;
    }

    if (toStatus === 'PENDING') {
      // A mere intermediate state — no audit/notification/order-update.
      return updated;
    }

    await this.auditLogService.record({
      actorId: actor ? new Types.ObjectId(actor.id) : undefined,
      actorRole: actor?.role,
      action: paymentAuditAction(toStatus),
      success: toStatus !== 'FAILED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        paymentId: updated._id.toString(),
        orderId: updated.orderId.toString(),
        status: toStatus,
      },
    });

    const order = await this.ordersService.getOrderById(updated.orderId.toString(), {
      id: updated.userId.toString(),
      role: 'student',
    });

    if (toStatus === 'SUCCESS') {
      await this.ordersService.updatePaymentStatus(updated.orderId.toString(), 'paid');
      await this.notificationsService.notifyOrderEvent({
        userId: updated.userId,
        type: 'payment_success',
        orderId: updated.orderId,
        orderNumber: order.orderNumber,
        amount: updated.amount,
      });
    } else if (toStatus === 'FAILED') {
      // Order kept intact — no updatePaymentStatus call.
      await this.notificationsService.notifyOrderEvent({
        userId: updated.userId,
        type: 'payment_failed',
        orderId: updated.orderId,
        orderNumber: order.orderNumber,
        failureReason: updated.failureReason,
      });
    } else if (toStatus === 'REFUNDED') {
      await this.ordersService.updatePaymentStatus(updated.orderId.toString(), 'refunded');
      await this.notificationsService.notifyOrderEvent({
        userId: updated.userId,
        type: 'payment_refunded',
        orderId: updated.orderId,
        orderNumber: order.orderNumber,
        amount: updated.refundedAmount ?? updated.amount,
      });
    }

    return updated;
  }
}
