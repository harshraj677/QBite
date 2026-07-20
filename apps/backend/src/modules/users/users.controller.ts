import { NotFoundError } from '@errors/http-errors';
import { sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import { toPublicUserDto } from './user.types';
import { UsersService } from './users.service';
import type { UserIdParam } from './users.validation';

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call UsersService, shape the response — same convention as every other module's controller. */
export class UsersController {
  constructor(private readonly usersService: UsersService = new UsersService()) {}

  getById = catchAsync(async (req, res) => {
    const { id } = req.params as unknown as UserIdParam;
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found.');
    }
    sendSuccess(res, { user: toPublicUserDto(user) });
  });
}
