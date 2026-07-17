import type { Request } from 'express';

import { UnauthorizedError } from '@errors/http-errors';
import { sendPaginated, sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import type { RequestMeta } from './menu-categories.service';
import { MenuCategoriesService } from './menu-categories.service';
import type {
  CanteenIdParam,
  CategoryIdParam,
  CreateMenuCategoryInput,
  DeleteMenuCategoryQuery,
  ListMenuCategoriesQuery,
  ReorderMenuCategoryInput,
  UpdateMenuCategoryInput,
} from './menu-categories.validation';

function extractMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.header('User-Agent') };
}

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call MenuCategoriesService, shape the response — business logic lives entirely in the service. Same convention as CanteensController. */
export class MenuCategoriesController {
  constructor(
    private readonly categoriesService: MenuCategoriesService = new MenuCategoriesService(),
  ) {}

  create = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { canteenId } = req.params as unknown as CanteenIdParam;
    const category = await this.categoriesService.createCategory(
      canteenId,
      req.body as CreateMenuCategoryInput,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { category }, 201);
  });

  list = catchAsync(async (req, res) => {
    const { canteenId } = req.params as unknown as CanteenIdParam;
    const query = req.query as unknown as ListMenuCategoriesQuery;
    const { categories, total } = await this.categoriesService.listCategories(canteenId, query);
    sendPaginated(res, categories, {
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    });
  });

  getById = catchAsync(async (req, res) => {
    const { id } = req.params as unknown as CategoryIdParam;
    const category = await this.categoriesService.getCategoryById(id);
    sendSuccess(res, { category });
  });

  update = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as CategoryIdParam;
    const category = await this.categoriesService.updateCategory(
      id,
      req.body as UpdateMenuCategoryInput,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { category });
  });

  remove = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as CategoryIdParam;
    const { force } = req.query as unknown as DeleteMenuCategoryQuery;
    await this.categoriesService.deleteCategory(
      id,
      force,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, null);
  });

  reorder = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as CategoryIdParam;
    const { displayOrder } = req.body as ReorderMenuCategoryInput;
    const category = await this.categoriesService.reorderCategory(
      id,
      displayOrder,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { category });
  });
}
