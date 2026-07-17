import mongoose from 'mongoose';

/**
 * Mongoose connection utility.
 *
 * Defined and ready, but intentionally NOT invoked anywhere in the
 * current bootstrap (see server.ts). Wiring this into the startup
 * sequence — along with schema/index validation per DATABASE_DESIGN.md —
 * is a Phase 3 task, not part of the engineering-foundation phase.
 */
export async function connectDatabase(mongoUri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(mongoUri);
}
