import { OrdersService } from '@modules/orders/orders.service';
import type {
  PublicOrderListResult,
  PublicOrderWithItemsDto,
} from '@modules/orders/orders.service';
import type { PublicOrderDto } from '@modules/orders/order.types';
import type { UserRole } from '@modules/users/user.types';
import type { ListKitchenOrdersQuery } from './kitchen.validation';

export interface AuditActor {
  id: string;
  role: UserRole;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Pure delegation facade over `OrdersService` — contains **zero**
 * independent business logic. Every method here maps 1:1 onto an
 * existing `OrdersService` capability: forward-transition rules, the
 * atomic repository-level transition guard, ownership/immutability
 * checks, pricing/snapshot immutability, and audit logging all
 * already live correctly in `orders/` (see ARCHITECTURE.md §3.1's
 * `modules/kitchen` note). This class exists only so
 * `KitchenController` has a service to depend on, matching the
 * project's `routes → controller → service → repository → model`
 * layering rule uniformly across every module — not because Kitchen
 * has rules of its own to enforce.
 *
 * A direct consequence: `accept`/`startPreparing`/`markReady`/
 * `completePickup` don't (and can't) do anything a kitchen_staff
 * account isn't allowed to do — cancelling, editing pricing/items/
 * snapshots, or touching payment information are simply never exposed
 * here, and completed/cancelled orders stay immutable because
 * `OrdersService.updateStatus`'s own `FORWARD_TRANSITIONS` guard
 * already rejects any transition out of either terminal state.
 */
export class KitchenService {
  constructor(private readonly ordersService: OrdersService = new OrdersService()) {}

  async listOrders(query: ListKitchenOrdersQuery): Promise<PublicOrderListResult> {
    return this.ordersService.searchOrders({
      status: query.status,
      orderNumber: query.orderNumber,
      pickupToken: query.pickupToken,
      page: query.page,
      limit: query.limit,
      sortBy: 'createdAt',
      sortOrder: query.sortOrder,
    });
  }

  async getOrder(id: string, actor: AuditActor): Promise<PublicOrderWithItemsDto> {
    return this.ordersService.getOrderById(id, actor);
  }

  async acceptOrder(id: string, actor: AuditActor, meta: RequestMeta): Promise<PublicOrderDto> {
    return this.ordersService.updateStatus(id, 'accepted', actor, meta);
  }

  async startPreparing(id: string, actor: AuditActor, meta: RequestMeta): Promise<PublicOrderDto> {
    return this.ordersService.updateStatus(id, 'preparing', actor, meta);
  }

  async markReady(id: string, actor: AuditActor, meta: RequestMeta): Promise<PublicOrderDto> {
    return this.ordersService.updateStatus(id, 'ready', actor, meta);
  }

  async completePickup(id: string, actor: AuditActor, meta: RequestMeta): Promise<PublicOrderDto> {
    return this.ordersService.updateStatus(id, 'completed', actor, meta);
  }
}
