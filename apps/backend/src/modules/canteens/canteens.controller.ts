import { UnauthorizedError } from '@errors/http-errors';
import { sendPaginated, sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import { CanteensService } from './canteens.service';
import type {
  CanteenIdParam,
  CreateCanteenInput,
  ListCanteensQuery,
  UpdateCanteenInput,
} from './canteens.validation';

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call CanteensService, shape the response — business logic lives entirely in the service. */
export class CanteensController {
  constructor(private readonly canteensService: CanteensService = new CanteensService()) {}

  create = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const canteen = await this.canteensService.createCanteen(
      req.body as CreateCanteenInput,
      req.user.id,
    );
    sendSuccess(res, { canteen }, 201);
  });

  list = catchAsync(async (req, res) => {
    const query = req.query as unknown as ListCanteensQuery;
    const { canteens, total } = await this.canteensService.listCanteens(query);
    sendPaginated(res, canteens, {
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    });
  });

  getById = catchAsync(async (req, res) => {
    const { id } = req.params as unknown as CanteenIdParam;
    const canteen = await this.canteensService.getCanteenById(id);
    sendSuccess(res, { canteen });
  });

  update = catchAsync(async (req, res) => {
    const { id } = req.params as unknown as CanteenIdParam;
    const canteen = await this.canteensService.updateCanteen(id, req.body as UpdateCanteenInput);
    sendSuccess(res, { canteen });
  });

  remove = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as CanteenIdParam;
    await this.canteensService.deleteCanteen(id, req.user.id);
    sendSuccess(res, null);
  });

  toggleStatus = catchAsync(async (req, res) => {
    const { id } = req.params as unknown as CanteenIdParam;
    const canteen = await this.canteensService.toggleStatus(id);
    sendSuccess(res, { canteen });
  });
}
