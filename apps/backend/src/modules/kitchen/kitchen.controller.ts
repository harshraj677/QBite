import type { Request } from 'express';

import { UnauthorizedError } from '@errors/http-errors';
import { sendPaginated, sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import type { RequestMeta } from './kitchen.service';
import { KitchenService } from './kitchen.service';
import type { KitchenOrderIdParam, ListKitchenOrdersQuery } from './kitchen.validation';

function extractMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.header('User-Agent') };
}

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call KitchenService, shape the response — same convention as every other module's controller. Business logic lives entirely in OrdersService (see kitchen.service.ts's doc comment). */
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService = new KitchenService()) {}

  list = catchAsync(async (req, res) => {
    const query = req.query as unknown as ListKitchenOrdersQuery;
    const { orders, total } = await this.kitchenService.listOrders(query);
    sendPaginated(res, orders, {
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    });
  });

  getById = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as KitchenOrderIdParam;
    const order = await this.kitchenService.getOrder(id, {
      id: req.user.id,
      role: req.user.role,
    });
    sendSuccess(res, { order });
  });

  accept = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as KitchenOrderIdParam;
    const order = await this.kitchenService.acceptOrder(
      id,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { order });
  });

  startPreparing = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as KitchenOrderIdParam;
    const order = await this.kitchenService.startPreparing(
      id,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { order });
  });

  markReady = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as KitchenOrderIdParam;
    const order = await this.kitchenService.markReady(
      id,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { order });
  });

  completePickup = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as KitchenOrderIdParam;
    const order = await this.kitchenService.completePickup(
      id,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { order });
  });
}
