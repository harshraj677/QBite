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

  // Renamed from MONGO_URI (env-configuration phase) — Atlas in
  // staging/production, a local mongod in development. Only the raw
  // key changed; the parsed config field below is still `mongoUri`,
  // so no consuming module (database.ts, etc.) needed to change.
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/qbite_dev'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(1).default('dev-placeholder-access-secret'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev-placeholder-refresh-secret'),
  // Renamed from JWT_ACCESS_EXPIRY/JWT_REFRESH_EXPIRY — same reasoning as MONGODB_URI above.
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),

  // Not yet consumed anywhere — modules/auth/auth.constants.ts still
  // hardcodes PASSWORD_BCRYPT_ROUNDS (12) and OTP_BCRYPT_ROUNDS (10).
  // Wiring this in means editing that existing module, which the
  // environment-configuration phase this was added in explicitly
  // scoped out ("do not modify existing modules"). Validated and
  // available as `env.bcryptSaltRounds` for whichever future phase
  // takes on that change. Default (12) matches PASSWORD_BCRYPT_ROUNDS
  // so wiring it in later is a behavior no-op unless the value in .env
  // is deliberately changed.
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  // Renamed from RATE_LIMIT_MAX — same reasoning as MONGODB_URI above.
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // Not yet consumed — logging/logger.ts still derives its pino level
  // from NODE_ENV directly (silent in test, info in production, debug
  // otherwise). Same "don't touch existing modules this phase" reason
  // as BCRYPT_SALT_ROUNDS above; validated and available as
  // `env.logLevel` for whichever future phase wires it in.
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Optional: restricts POST /auth/register's collegeEmail to this
  // domain (e.g. "college.edu"). Unset = any valid email accepted —
  // the specific institution's domain isn't known at this stage.
  //
  // `.optional()` alone only tolerates the key being *absent* from
  // process.env — a real .env file that declares it with no value
  // (`COLLEGE_EMAIL_DOMAIN=`, the same style .env.example already
  // uses for every other optional field) sets it to `''`, which then
  // fails `.min(1)`. This went undetected through every prior phase
  // because no apps/backend/.env file existed yet; it surfaced the
  // moment the environment-configuration phase created one. The
  // transform normalizes "absent" and "present but empty" to the same
  // `undefined`, matching the "unset = any email accepted" comment
  // above for both cases instead of just one of them.
  COLLEGE_EMAIL_DOMAIN: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
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
    mongoUri: raw.MONGODB_URI,
    redisUrl: raw.REDIS_URL,
    jwt: {
      accessSecret: raw.JWT_ACCESS_SECRET,
      refreshSecret: raw.JWT_REFRESH_SECRET,
      accessExpiry: raw.JWT_ACCESS_EXPIRES_IN,
      refreshExpiry: raw.JWT_REFRESH_EXPIRES_IN,
    },
    bcryptSaltRounds: raw.BCRYPT_SALT_ROUNDS,
    corsOrigin: raw.CORS_ORIGIN,
    rateLimit: {
      windowMs: raw.RATE_LIMIT_WINDOW_MS,
      max: raw.RATE_LIMIT_MAX_REQUESTS,
    },
    logLevel: raw.LOG_LEVEL,
    collegeEmailDomain: raw.COLLEGE_EMAIL_DOMAIN,
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
