import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';

export const userIdParamSchema = z.object({
  id: objectIdSchema,
});
export type UserIdParam = z.infer<typeof userIdParamSchema>;
