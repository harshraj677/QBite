import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped context, propagated automatically through async calls
 * for the lifetime of a single request — without threading a
 * `requestId` parameter through every function signature.
 *
 * Populated once per request by `middlewares/request-id.middleware.ts`
 * (which wraps the rest of the request in `runWithContext`). Consumed
 * by `logging/logger.ts`'s `mixin` so every log line automatically
 * carries the request ID. Extend `RequestContext` here if a future
 * phase needs more request-scoped state (e.g. the authenticated
 * user's ID) — this is the one place that shape is defined.
 */
export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
