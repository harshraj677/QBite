import { createApp } from './app';
import { env } from '@config/env';

/**
 * Process entry point.
 *
 * Boots the HTTP server only. Database connection (connectDatabase, in
 * config/database.ts) and the Socket.IO real-time layer are wired in
 * here starting in Phase 3 — not part of the engineering-foundation
 * scaffold.
 */
const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`QBite API foundation listening on port ${env.port} [${env.nodeEnv}]`);
});
