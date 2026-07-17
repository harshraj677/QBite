import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

/**
 * Centralized, validated environment configuration.
 *
 * Per ARCHITECTURE.md §3.5 / §9.4 ("fail fast, fail loud"): a required
 * variable missing or malformed crashes the process immediately with a
 * clear, itemized message, rather than surfacing as an obscure
 * `undefined` deep in a request handler later. Zod is used here for the
 * same reason it's used for request validation (see
 * validation/validate-request.middleware.ts) — one schema-validation
 * approach for both jobs.
 *
 * No values are *consumed* yet (no DB connection, no auth) — this
 * module only defines and validates the shape of configuration.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/qbite_dev'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(1).default('dev-placeholder-access-secret'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev-placeholder-refresh-secret'),
  JWT_ACCESS_EXPIRY: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRY: z.string().min(1).default('30d'),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const raw = parsed.data;

  return {
    nodeEnv: raw.NODE_ENV,
    port: raw.PORT,
    mongoUri: raw.MONGO_URI,
    redisUrl: raw.REDIS_URL,
    jwt: {
      accessSecret: raw.JWT_ACCESS_SECRET,
      refreshSecret: raw.JWT_REFRESH_SECRET,
      accessExpiry: raw.JWT_ACCESS_EXPIRY,
      refreshExpiry: raw.JWT_REFRESH_EXPIRY,
    },
    corsOrigin: raw.CORS_ORIGIN,
    rateLimit: {
      windowMs: raw.RATE_LIMIT_WINDOW_MS,
      max: raw.RATE_LIMIT_MAX,
    },
  };
}

export const env = loadConfig();
export type EnvConfig = typeof env;

// Dev-convenience defaults above must never silently apply in production.
if (env.nodeEnv === 'production') {
  const placeholders = ['dev-placeholder-access-secret', 'dev-placeholder-refresh-secret'];
  if (placeholders.includes(env.jwt.accessSecret) || placeholders.includes(env.jwt.refreshSecret)) {
    throw new Error('Refusing to start: placeholder JWT secrets detected in production.');
  }
}
