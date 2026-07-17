import type { Request } from 'express';

import { UnauthorizedError } from '@errors/http-errors';
import { sendPaginated, sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import type { RequestMeta } from './menu-items.service';
import { MenuItemsService } from './menu-items.service';
import type {
  CanteenIdParam,
  CreateMenuItemInput,
  ListMenuItemsQuery,
  MenuItemIdParam,
  ReorderMenuItemInput,
  UpdateAvailabilityInput,
  UpdateFeaturedInput,
  UpdateMenuItemInput,
} from './menu-items.validation';

function extractMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.header('User-Agent') };
}

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call MenuItemsService, shape the response — business logic lives entirely in the service. Same convention as CanteensController/MenuCategoriesController. */
export class MenuItemsController {
  constructor(private readonly itemsService: MenuItemsService = new MenuItemsService()) {}

  create = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { canteenId } = req.params as unknown as CanteenIdParam;
    const item = await this.itemsService.createItem(
      canteenId,
      req.body as CreateMenuItemInput,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { item }, 201);
  });

  list = catchAsync(async (req, res) => {
    const { canteenId } = req.params as unknown as CanteenIdParam;
    const query = req.query as unknown as ListMenuItemsQuery;
    const { items, total } = await this.itemsService.listItems(canteenId, query);
    sendPaginated(res, items, {
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    });
  });

  getById = catchAsync(async (req, res) => {
    const { id } = req.params as unknown as MenuItemIdParam;
    const item = await this.itemsService.getItemById(id);
    sendSuccess(res, { item });
  });

  update = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as MenuItemIdParam;
    const item = await this.itemsService.updateItem(
      id,
      req.body as UpdateMenuItemInput,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { item });
  });

  remove = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as MenuItemIdParam;
    await this.itemsService.deleteItem(
      id,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, null);
  });

  updateAvailability = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as MenuItemIdParam;
    const { isAvailable } = req.body as UpdateAvailabilityInput;
    const item = await this.itemsService.setAvailability(
      id,
      isAvailable,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { item });
  });

  updateFeatured = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as MenuItemIdParam;
    const { isFeatured } = req.body as UpdateFeaturedInput;
    const item = await this.itemsService.setFeatured(
      id,
      isFeatured,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { item });
  });

  reorder = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as MenuItemIdParam;
    const { displayOrder } = req.body as ReorderMenuItemInput;
    const item = await this.itemsService.reorderItem(
      id,
      displayOrder,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { item });
  });
}
