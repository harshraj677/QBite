import type { Request } from 'express';

import { NotFoundError, UnauthorizedError } from '@errors/http-errors';
import { sendPaginated, sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import { toPublicUserDto } from './user.types';
import { UsersService } from './users.service';
import type {
  ListUsersQuery,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
  UserIdParam,
} from './users.validation';

function extractMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  return { ipAddress: req.ip, userAgent: req.header('User-Agent') };
}

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call UsersService, shape the response — business logic (including the role/status legality rules) lives entirely in the service, same convention as every other module's controller. */
export class UsersController {
  constructor(private readonly usersService: UsersService = new UsersService()) {}

  list = catchAsync(async (req, res) => {
    const query = req.query as unknown as ListUsersQuery;
    const { users, total } = await this.usersService.searchUsers(query);
    sendPaginated(res, users.map(toPublicUserDto), {
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    });
  });

  getById = catchAsync(async (req, res) => {
    const { id } = req.params as unknown as UserIdParam;
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found.');
    }
    sendSuccess(res, { user: toPublicUserDto(user) });
  });

  updateRole = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as UserIdParam;
    const { role } = req.body as UpdateUserRoleInput;
    const user = await this.usersService.updateRole(
      id,
      role,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { user: toPublicUserDto(user) });
  });

  updateStatus = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as UserIdParam;
    const { isActive } = req.body as UpdateUserStatusInput;
    const user = await this.usersService.setActive(
      id,
      isActive,
      { id: req.user.id, role: req.user.role },
      extractMeta(req),
    );
    sendSuccess(res, { user: toPublicUserDto(user) });
  });
}
