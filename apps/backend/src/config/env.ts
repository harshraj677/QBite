import { config as loadEnv } from 'dotenv';

loadEnv();

/**
 * Centralized, validated environment configuration.
 *
 * Per ARCHITECTURE.md §3.5 / §9.4 ("fail fast, fail loud"): a required
 * variable missing at boot crashes the process immediately with a clear
 * message, rather than surfacing as an obscure `undefined` deep in a
 * request handler later.
 *
 * No values are consumed yet (no DB connection, no auth) — this module
 * only defines and validates the shape of configuration for later use.
 */

interface EnvConfig {
  nodeEnv: 'development' | 'staging' | 'production' | 'test';
  port: number;
  mongoUri: string;
  redisUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  corsOrigin: string;
}

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function loadConfig(): EnvConfig {
  return {
    nodeEnv: (process.env.NODE_ENV as EnvConfig['nodeEnv']) ?? 'development',
    port: Number(process.env.PORT ?? 4000),
    mongoUri: requireEnv('MONGO_URI', 'mongodb://localhost:27017/qbite_dev'),
    redisUrl: requireEnv('REDIS_URL', 'redis://localhost:6379'),
    jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET', 'dev-placeholder-access-secret'),
    jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-placeholder-refresh-secret'),
    corsOrigin: requireEnv('CORS_ORIGIN', 'http://localhost:3000'),
  };
}

export const env: EnvConfig = loadConfig();

// Dev-convenience fallbacks above must never silently apply in production.
if (env.nodeEnv === 'production') {
  const placeholders = ['dev-placeholder-access-secret', 'dev-placeholder-refresh-secret'];
  if (placeholders.includes(env.jwtAccessSecret) || placeholders.includes(env.jwtRefreshSecret)) {
    throw new Error('Refusing to start: placeholder JWT secrets detected in production.');
  }
}
