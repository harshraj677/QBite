import http from 'node:http';

import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from '@config/database';
import { env } from '@config/env';
import { logger } from '@logging/logger';

/**
 * Process entry point: application bootstrap + HTTP server lifecycle.
 *
 * `createApp()` only builds the Express app (middleware, mounts) — the
 * concerns here are connecting dependencies, starting the server,
 * stopping it cleanly, and not leaving the process in an undefined
 * state if something goes wrong.
 *
 * `connectDatabase()` is called here for the first time in the
 * project — every prior phase deliberately left it uninvoked because
 * there were no real persisted models yet. The IAM module (User,
 * RefreshToken, VerificationOTP, PasswordResetToken, AuditLog) is why
 * that changes now. The server does not start accepting traffic until
 * the database connection succeeds — failing fast on a bad DB
 * connection is better than accepting requests that can only 500.
 */
async function bootstrap(): Promise<void> {
  await connectDatabase(env.mongoUri);

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.port, () => {
    logger.info(`QBite API listening on port ${env.port} [${env.nodeEnv}]`);
  });

  const SHUTDOWN_TIMEOUT_MS = 10_000;

  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error while closing HTTP server');
      }

      try {
        await disconnectDatabase();
      } catch (disconnectError) {
        logger.error({ err: disconnectError }, 'Error while disconnecting database');
      }

      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown complete');
      process.exit(err ? 1 : 0);
    });
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// Last line of defense: log and exit rather than leaving the process
// running in a corrupted state. An operational (AppError) failure
// never reaches here — it's caught by errorHandler. This only fires
// for genuine bugs (including a failed bootstrap — see .catch below).
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  process.exit(1);
});

bootstrap().catch((error: unknown) => {
  logger.error({ err: error }, 'Fatal error during bootstrap');
  process.exit(1);
});
