import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './notifications.constants';

export const notificationIdParamSchema = z.object({
  id: objectIdSchema,
});
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  isRead: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  // Newest first by default — same convention as orders.validation.ts's list schemas.
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
