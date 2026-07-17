import mongoose from 'mongoose';

import { logger } from '@logging/logger';

/**
 * Mongoose connection abstraction.
 *
 * Defined and fully ready, but intentionally NOT invoked anywhere in
 * the current bootstrap (see server.ts) — per this phase's explicit
 * rule, nothing connects to MongoDB yet. Wiring `connectDatabase` into
 * the startup sequence, plus schema/index definitions per
 * docs/DATABASE_DESIGN.md, is a subsequent phase's task.
 */

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection established');
});

mongoose.connection.on('error', (error: Error) => {
  logger.error({ err: error }, 'MongoDB connection error');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost');
});

export async function connectDatabase(mongoUri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10_000,
  });
}

/**
 * Used by the graceful-shutdown sequence in server.ts. Guarded on
 * `readyState` so it is always safe to call, including — as is
 * currently the case — when no connection was ever opened.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.disconnected) {
    return;
  }
  await mongoose.disconnect();
}
