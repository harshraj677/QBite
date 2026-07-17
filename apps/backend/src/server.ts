import http from 'node:http';

import { createApp } from './app';
import { disconnectDatabase } from '@config/database';
import { env } from '@config/env';
import { logger } from '@logging/logger';

/**
 * Process entry point: application bootstrap + HTTP server lifecycle.
 *
 * `createApp()` only builds the Express app (middleware, mounts) — the
 * concerns here are starting it, stopping it cleanly, and not leaving
 * the process in an undefined state if something goes wrong.
 *
 * Database connection (`connectDatabase`, in config/database.ts) is
 * deliberately NOT called here — nothing connects to MongoDB in this
 * phase. `disconnectDatabase()` is still wired into the shutdown
 * sequence below because it's a guarded no-op when nothing is
 * connected, and the shutdown sequence needs to be correct for when a
 * later phase adds the `connectDatabase()` call — not rewritten then.
 */
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

// Last line of defense: log and exit rather than leaving the process
// running in a corrupted state. An operational (AppError) failure
// never reaches here — it's caught by errorHandler. This only fires
// for genuine bugs.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  process.exit(1);
});
