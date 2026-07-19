import { randomBytes, randomInt } from 'node:crypto';

import { Types } from 'mongoose';

import { AuditLogService } from '@modules/audit/audit-log.service';
import type { AuditAction } from '@modules/audit/audit-log.types';
import { CanteensService } from '@modules/canteens/canteens.service';
import { MenuCategoriesService } from '@modules/menu/menu-categories.service';
import { MenuItemsService } from '@modules/menu/menu-items.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import type { NotificationType } from '@modules/notifications/notification.types';
import type { UserRole } from '@modules/users/user.types';
import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnprocessableEntityError,
} from '@errors/http-errors';
import { OrderItemsRepository } from './order-items.repository';
import type { PublicOrderItemDto } from './order-item.types';
import { toPublicOrderItemDto } from './order-item.types';
import { OrdersRepository } from './orders.repository';
import {
  CANCELLABLE_ORDER_STATUSES,
  FORWARD_TRANSITIONS,
  ORDER_TAX_RATE_PERCENT,
} from './orders.constants';
import type { OrderSortableField } from './orders.constants';
import type { IOrder, OrderStatus, PublicOrderDto } from './order.types';
import { toPublicOrderDto } from './order.types';
import type {
  CreateOrderInput,
  ListCanteenOrdersQuery,
  ListMyOrdersQuery,
} from './orders.validation';

export interface AuditActor {
  id: string;
  role: UserRole;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface PublicOrderWithItemsDto extends PublicOrderDto {
  items: PublicOrderItemDto[];
}

export interface PublicOrderListResult {
  orders: PublicOrderDto[];
  total: number;
}

/** Same shape MongoDB's duplicate-key error carries — duplicated per-module, matching the established pattern. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}

/** Human-readable, unique (enforced by the DB index) — see docs/DATABASE_DESIGN.md §2.17's `QB-2026-000123`-style example. Retried on collision, not sequential, so no counter/sequence collection is needed for this phase's volume. */
function generateOrderNumber(): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `QB-${new Date().getFullYear()}-${suffix}`;
}

/** Not a secret — shown by the student and read back by kitchen staff at the pickup counter, same threat model as a queue-number ticket. 6 digits, easy to read off a phone screen. */
function generatePickupToken(): string {
  return randomInt(100000, 1_000_000).toString();
}

/**
 * Per-transition audit action names — replaces the single generic
 * `order.status_updated` this method used before the Kitchen Workflow
 * phase (see ARCHITECTURE.md §3.1's `modules/kitchen` note for the
 * full justification: Kitchen's endpoints and the direct
 * `PATCH /orders/:id/status` endpoint both funnel through this same
 * method, so fixing the naming here — once — gives both callers
 * precise audit events instead of Kitchen having to log a second,
 * redundant entry on top of a generic one).
 *
 * `newStatus` is typed as the full `OrderStatus` for this private
 * helper's caller's convenience, but by the time it's invoked
 * `FORWARD_TRANSITIONS[existing.status].includes(newStatus)` has
 * already guaranteed it's one of these four — `pending`/`cancelled`
 * never appear as a *value* in that map, only as keys with empty
 * transition lists. The default branch is defensive, not reachable.
 */
function statusUpdateAuditAction(newStatus: OrderStatus): AuditAction {
  switch (newStatus) {
    case 'accepted':
      return 'order.accepted';
    case 'preparing':
      return 'order.preparing';
    case 'ready':
      return 'order.ready';
    case 'completed':
      return 'order.completed';
    default:
      throw new InternalServerError(`No audit action mapped for order status "${newStatus}".`);
  }
}

/**
 * Same exhaustiveness contract as `statusUpdateAuditAction` above —
 * added for the Notifications phase (see ARCHITECTURE.md §3.1's
 * `modules/notifications` note). Kept as its own function rather than
 * folded into `statusUpdateAuditAction` because the two produce
 * values for different modules' closed enums; a shared helper would
 * couple `AuditAction` and `NotificationType` for no reason.
 */
function statusNotificationType(newStatus: OrderStatus): NotificationType {
  switch (newStatus) {
    case 'accepted':
      return 'order_accepted';
    case 'preparing':
      return 'order_preparing';
    case 'ready':
      return 'order_ready';
    case 'completed':
      return 'order_completed';
    default:
      throw new InternalServerError(`No notification type mapped for order status "${newStatus}".`);
  }
}

/**
 * Business rules for `orders`/`order_items`. Depends on its own two
 * repositories, `CanteensService`/`MenuCategoriesService`/
 * `MenuItemsService`/`NotificationsService` (cross-module, via their
 * public services — never a repository), and `AuditLogService`.
 */
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository = new OrdersRepository(),
    private readonly orderItemsRepository: OrderItemsRepository = new OrderItemsRepository(),
    private readonly canteensService: CanteensService = new CanteensService(),
    private readonly menuCategoriesService: MenuCategoriesService = new MenuCategoriesService(),
    private readonly menuItemsService: MenuItemsService = new MenuItemsService(),
    private readonly auditLogService: AuditLogService = new AuditLogService(),
    private readonly notificationsService: NotificationsService = new NotificationsService(),
  ) {}

  /**
   * Two collections are written per order (`orders` + `order_items`),
   * and this project doesn't use multi-document transactions anywhere
   * (mongodb-memory-server's default standalone instance doesn't
   * support them, and no other module has needed one). To avoid ever
   * leaving an orphaned document if the second write fails, this
   * pre-generates the Order's `_id` and writes `order_items` FIRST,
   * referencing that id — if that write fails, no Order document
   * exists yet, so there is nothing to clean up. The Order itself is
   * written LAST, since it's the only side with a uniqueness
   * constraint that can collide (`orderNumber`/`pickupToken`); a
   * collision there is a safe, side-effect-free retry with fresh
   * values — the items already reference the right `orderId` and
   * never need to change.
   */
  async placeOrder(
    canteenId: string,
    input: CreateOrderInput,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicOrderWithItemsDto> {
    await this.canteensService.getCanteenById(canteenId);

    const lineItems = [];
    for (const line of input.items) {
      const menuItem = await this.menuItemsService.getItemById(line.menuItemId);
      if (menuItem.canteenId !== canteenId) {
        throw new UnprocessableEntityError(
          'ORDER_ITEM_CANTEEN_MISMATCH',
          `"${menuItem.name}" does not belong to this canteen.`,
        );
      }
      if (!menuItem.isAvailable) {
        throw new UnprocessableEntityError(
          'ORDER_ITEM_NOT_AVAILABLE',
          `"${menuItem.name}" is not currently available.`,
        );
      }
      const category = await this.menuCategoriesService.getCategoryById(menuItem.categoryId);
      lineItems.push({ menuItem, category, quantity: line.quantity, notes: line.notes });
    }

    const subtotal = lineItems.reduce((sum, line) => sum + line.menuItem.price * line.quantity, 0);
    const tax = Math.round((subtotal * ORDER_TAX_RATE_PERCENT) / 100);
    const discount = 0; // No coupon/discount module exists yet — always 0 in this phase.
    const totalAmount = subtotal + tax - discount;
    // Items are prepared in parallel by the kitchen, not sequentially — the
    // slowest item bounds the wait, not the sum of every item's prep time.
    const estimatedReadyTimeMinutes = Math.max(
      ...lineItems.map((line) => line.menuItem.preparationTimeMinutes),
    );

    const orderId = new Types.ObjectId();

    const createdItems = await this.orderItemsRepository.createMany(
      lineItems.map((line) => ({
        orderId,
        menuItemId: new Types.ObjectId(line.menuItem.id),
        quantity: line.quantity,
        unitPrice: line.menuItem.price,
        totalPrice: line.menuItem.price * line.quantity,
        notes: line.notes,
        itemSnapshot: {
          itemId: line.menuItem.id,
          itemName: line.menuItem.name,
          categoryName: line.category.name,
          image: line.menuItem.image,
          unitPrice: line.menuItem.price,
          isVeg: line.menuItem.isVeg,
        },
      })),
    );

    let order: IOrder | undefined;
    let lastError: unknown;
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        order = await this.ordersRepository.create({
          _id: orderId,
          orderNumber: generateOrderNumber(),
          canteenId,
          studentId: actor.id,
          paymentMethod: input.paymentMethod,
          subtotal,
          tax,
          discount,
          totalAmount,
          pickupToken: generatePickupToken(),
          estimatedReadyTimeMinutes,
          notes: input.notes,
        });
        break;
      } catch (error) {
        lastError = error;
        if (!isDuplicateKeyError(error)) throw error;
      }
    }
    if (!order) {
      throw lastError instanceof Error
        ? lastError
        : new InternalServerError('Failed to generate a unique order number.');
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'order.created',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { orderId: order._id.toString(), canteenId, totalAmount },
    });

    await this.notificationsService.notifyOrderEvent({
      userId: order.studentId,
      type: 'order_placed',
      orderId: order._id,
      orderNumber: order.orderNumber,
    });

    return { ...toPublicOrderDto(order), items: createdItems.map(toPublicOrderItemDto) };
  }

  async getOrderById(id: string, actor: AuditActor): Promise<PublicOrderWithItemsDto> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found.');
    }
    if (actor.role === 'student' && order.studentId.toString() !== actor.id) {
      throw new ForbiddenError('ORDER_ACCESS_DENIED', 'You do not have access to this order.');
    }

    const items = await this.orderItemsRepository.findByOrderId(order._id);
    return { ...toPublicOrderDto(order), items: items.map(toPublicOrderItemDto) };
  }

  async listMyOrders(studentId: string, query: ListMyOrdersQuery): Promise<PublicOrderListResult> {
    const result = await this.ordersRepository.findByStudent(studentId, {
      page: query.page,
      limit: query.limit,
      orderNumber: query.orderNumber,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return { orders: result.orders.map(toPublicOrderDto), total: result.total };
  }

  async listCanteenOrders(
    canteenId: string,
    query: ListCanteenOrdersQuery,
  ): Promise<PublicOrderListResult> {
    const result = await this.ordersRepository.findByCanteen(canteenId, {
      studentId: query.studentId,
      page: query.page,
      limit: query.limit,
      orderNumber: query.orderNumber,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return { orders: result.orders.map(toPublicOrderDto), total: result.total };
  }

  /**
   * Unscoped by canteen or student — added for the Kitchen Workflow
   * phase's dashboard (`GET /kitchen/orders`), which lists orders
   * across every canteen (kitchen_staff accounts aren't scoped to one
   * — see ARCHITECTURE.md §3.1's known-limitation note under
   * `modules/orders`). Takes a plain options object rather than a
   * Zod-inferred query type: the endpoint and its request shape are
   * owned by whichever module calls this (today, `modules/kitchen`),
   * not by `orders.validation.ts` — this method's only job is the data
   * fetch + business rules already governing `orders`, which do
   * belong here.
   */
  async searchOrders(options: {
    status?: OrderStatus;
    orderNumber?: string;
    pickupToken?: string;
    page: number;
    limit: number;
    sortBy: OrderSortableField;
    sortOrder: 'asc' | 'desc';
  }): Promise<PublicOrderListResult> {
    const result = await this.ordersRepository.search(options);
    return { orders: result.orders.map(toPublicOrderDto), total: result.total };
  }

  async updateStatus(
    id: string,
    newStatus: OrderStatus,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicOrderDto> {
    const existing = await this.ordersRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (!FORWARD_TRANSITIONS[existing.status].includes(newStatus)) {
      throw new ConflictError(
        'ORDER_INVALID_STATUS_TRANSITION',
        `Cannot transition an order from "${existing.status}" to "${newStatus}".`,
      );
    }

    // The repository's own filter re-asserts existing.status as a
    // precondition — a concurrent request that already advanced this
    // order between the read above and this write gets null back here
    // rather than silently double-applying a transition.
    const updated = await this.ordersRepository.updateStatus(id, existing.status, newStatus);
    if (!updated) {
      throw new ConflictError(
        'ORDER_INVALID_STATUS_TRANSITION',
        `Cannot transition an order from "${existing.status}" to "${newStatus}".`,
      );
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: statusUpdateAuditAction(newStatus),
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { orderId: id, fromStatus: existing.status, toStatus: newStatus },
    });

    await this.notificationsService.notifyOrderEvent({
      userId: updated.studentId,
      type: statusNotificationType(newStatus),
      orderId: updated._id,
      orderNumber: updated.orderNumber,
      pickupToken: updated.pickupToken,
    });

    return toPublicOrderDto(updated);
  }

  /**
   * A student may cancel only their own order, and only while it's
   * still `pending` (per the phase spec, verbatim). Staff/admin roles
   * that reach this method (see orders.routes.ts — `kitchen_staff` is
   * not among them, only `admin`/`super_admin`) may cancel any order
   * that hasn't reached a terminal state yet.
   */
  async cancelOrder(
    id: string,
    cancellationReason: string | undefined,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicOrderDto> {
    const existing = await this.ordersRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (actor.role === 'student') {
      if (existing.studentId.toString() !== actor.id) {
        throw new ForbiddenError('ORDER_ACCESS_DENIED', 'You do not have access to this order.');
      }
      if (existing.status !== 'pending') {
        throw new ConflictError(
          'ORDER_CANNOT_BE_CANCELLED',
          'An order can only be cancelled by the student while it is still pending.',
        );
      }
    } else if (!CANCELLABLE_ORDER_STATUSES.includes(existing.status)) {
      throw new ConflictError(
        'ORDER_CANNOT_BE_CANCELLED',
        `An order in "${existing.status}" status can no longer be cancelled.`,
      );
    }

    const reason =
      cancellationReason ??
      (actor.role === 'student' ? 'Cancelled by student.' : 'Cancelled by staff.');

    const updated = await this.ordersRepository.cancelOrder(id, reason);
    if (!updated) {
      throw new ConflictError(
        'ORDER_CANNOT_BE_CANCELLED',
        `An order in "${existing.status}" status can no longer be cancelled.`,
      );
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'order.cancelled',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { orderId: id, reason },
    });

    await this.notificationsService.notifyOrderEvent({
      userId: updated.studentId,
      type: 'order_cancelled',
      orderId: updated._id,
      orderNumber: updated.orderNumber,
      cancellationReason: reason,
    });

    return toPublicOrderDto(updated);
  }
}
