import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { runWithContext } from '@context/request-context';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Assigns a request ID (reusing an inbound `X-Request-Id` header if a
 * caller/proxy already set one, per API_SPECIFICATION.md §3 — otherwise
 * generates one via the built-in `crypto.randomUUID()`, no dependency
 * needed), echoes it back on the response, and runs the rest of the
 * request inside `runWithContext` so `context/request-context.ts` can
 * make it available to the logger (and anything else) without it being
 * passed as a parameter. Must be the first middleware registered — see
 * app.ts.
 */
export function requestId(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const inbound = req.header(REQUEST_ID_HEADER);
    const id = inbound && inbound.length > 0 ? inbound : randomUUID();

    req.id = id;
    res.setHeader(REQUEST_ID_HEADER, id);

    runWithContext({ requestId: id }, next);
  };
}
