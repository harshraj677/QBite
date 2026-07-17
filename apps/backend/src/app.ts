import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from '@config/env';

/**
 * Express application shell.
 *
 * Cross-cutting middleware only, wired in the order defined in
 * ARCHITECTURE.md §3.2. No routes are registered here — module routers
 * (auth, orders, restaurants, ...) are mounted starting in Phase 3, once
 * business logic implementation begins.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Module routers are mounted here in future phases, e.g.:
  // app.use('/api/v1/auth', authRouter);

  // Centralized error-handling middleware is added here in Phase 3,
  // per API_SPECIFICATION.md §5 (standard error envelope).

  return app;
}
