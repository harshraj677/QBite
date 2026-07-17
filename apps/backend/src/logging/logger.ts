import pino from 'pino';

import { env } from '@config/env';
import { getRequestId } from '@context/request-context';

/**
 * Application-wide structured logger.
 *
 * JSON output in every environment except development (where
 * `pino-pretty` gives readable console output) — JSON is what a log
 * aggregator (CloudWatch, Datadog, etc.) expects in staging/production.
 * Silent under `test` — integration tests exercise the full middleware
 * chain including this logger, and its output is noise in test/CI
 * runs, not signal.
 *
 * The `mixin` runs on every log call and merges the current request's
 * ID (see context/request-context.ts) into the log line automatically,
 * so call sites never pass a requestId explicitly — including deeply
 * nested service calls, once those exist.
 */
export const logger = pino({
  level: env.nodeEnv === 'test' ? 'silent' : env.nodeEnv === 'production' ? 'info' : 'debug',
  mixin() {
    const requestId = getRequestId();
    return requestId ? { requestId } : {};
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
  transport:
    env.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
});
