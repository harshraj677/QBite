import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * In-memory MongoDB for integration tests — an ephemeral, isolated
 * `mongod` process per test run (downloaded once, cached locally by
 * mongodb-memory-server), not a shared/external database. No test run
 * can leak state into another, and nothing external needs to be
 * running for `npm test` to work.
 */
let mongoServer: MongoMemoryServer | undefined;

export async function connectTestDb(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongoServer?.stop();
}

export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}
