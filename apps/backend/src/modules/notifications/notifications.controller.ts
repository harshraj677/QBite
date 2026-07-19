import { UnauthorizedError } from '@errors/http-errors';
import { sendPaginated, sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import { NotificationsService } from './notifications.service';
import type { ListNotificationsQuery, NotificationIdParam } from './notifications.validation';

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call NotificationsService, shape the response — same convention as every other module's controller. Every route is self-scoped to `req.user.id`; there is no admin-any-user path (see notifications.service.ts's doc comment). */
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService = new NotificationsService(),
  ) {}

  list = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const query = req.query as unknown as ListNotificationsQuery;
    const { notifications, total } = await this.notificationsService.listMyNotifications(
      req.user.id,
      query,
    );
    sendPaginated(res, notifications, {
      total,
      page: query.page,
      limit: query.limit,
      hasMore: query.page * query.limit < total,
    });
  });

  unreadCount = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    sendSuccess(res, { count });
  });

  markAsRead = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as NotificationIdParam;
    const notification = await this.notificationsService.markAsRead(id, req.user.id);
    sendSuccess(res, { notification });
  });

  markAllAsRead = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const result = await this.notificationsService.markAllAsRead(req.user.id);
    sendSuccess(res, result);
  });

  remove = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const { id } = req.params as unknown as NotificationIdParam;
    await this.notificationsService.deleteNotification(id, req.user.id);
    sendSuccess(res, null);
  });
}
