import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

import { ValidationError } from '@errors/http-errors';
import { replaceRequestProperty } from '@utils/replace-request-property';

/**
 * Generic request-validation middleware factory.
 *
 * No schemas are defined here — this is architecture, not a feature.
 * A future module uses it like:
 *
 *   router.post('/orders', validateRequest({ body: createOrderSchema }), ...)
 *
 * Schemas must resolve to an object shape (`z.object({...})`) — this
 * is what nearly every REST body/query/params schema is anyway, and
 * it's required here because a successful parse *replaces* the
 * contents of `req.body`/`req.params`/`req.query` in place (see
 * `utils/replace-request-property.ts` for why "in place" rather than
 * reassignment — Express 5 made `req.query` a getter with no setter).
 *
 * On failure, a `ValidationError` is thrown with `details` populated
 * from Zod's issue list, matching the error envelope in
 * docs/API_SPECIFICATION.md §5 — field-level errors arrive at the
 * client in one consistent shape regardless of which module raised
 * them.
 */
export interface RequestSchemas {
  body?: ZodType<Record<string, unknown>>;
  params?: ZodType<Record<string, unknown>>;
  query?: ZodType<Record<string, unknown>>;
}

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const [part, schema] of Object.entries(schemas) as [
      keyof RequestSchemas,
      ZodType<Record<string, unknown>>,
    ][]) {
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(new ValidationError(`Invalid request ${part}.`, details));
      }
      replaceRequestProperty(req[part] as object, result.data);
    }
    next();
  };
}
