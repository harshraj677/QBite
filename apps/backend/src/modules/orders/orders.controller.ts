import type { Request } from 'express';

import { UnauthorizedError } from '@errors/http-errors';
import { sendPaginated, sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import type { RequestMeta } from './orders.service';
import { OrdersService } from './orders.service';
import type {
  CancelOrderInput,
  CanteenIdParam,
  CreateOrderInput,
  ListCanteenOrdersQuery,
  ListMyOrdersQuery,
  OrderIdParam,
  UpdateOrderStatusInput,
} from './orders.validation';

function extractMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.header('User-Agent') };
}

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call OrdersService, shape the response — business logic lives entirely in the service. Same convention as every other module's controller. */
export class OrdersController {
  constructor(private readonly ordersService: OrdersService = new OrdersService()) {}

  create = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { canteenId } = req.params as unknown as CanteenIdParam;
    const order = await this.ordersService.placeOrder(
      canteenId,
      req.body as CreateOrderInput,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { order }, 201);
  });

  getById = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as OrderIdParam;
    const order = await this.ordersService.getOrderById(id, {
      id: req.user.id,
      role: req.user.role,
    });
    sendSuccess(res, { order });
  });

  listMine = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const query = req.query as unknown as ListMyOrdersQuery;
    const { orders, total } = await this.ordersService.listMyOrders(req.user.id, query);
    sendPaginated(res, orders, {
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    });
  });

  listForCanteen = catchAsync(async (req, res) => {
    const { canteenId } = req.params as unknown as CanteenIdParam;
    const query = req.query as unknown as ListCanteenOrdersQuery;
    const { orders, total } = await this.ordersService.listCanteenOrders(canteenId, query);
    sendPaginated(res, orders, {
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    });
  });

  updateStatus = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as OrderIdParam;
    const { status } = req.body as UpdateOrderStatusInput;
    const order = await this.ordersService.updateStatus(
      id,
      status,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { order });
  });

  cancel = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as OrderIdParam;
    const { cancellationReason } = req.body as CancelOrderInput;
    const order = await this.ordersService.cancelOrder(
      id,
      cancellationReason,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { order });
  });
}
