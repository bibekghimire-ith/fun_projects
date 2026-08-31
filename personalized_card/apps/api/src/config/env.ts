import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 chars'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 chars'),
  MEDIA_STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  MEDIA_LOCAL_PATH: z.string().default('./uploads'),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  APP_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  /** Lifetime of the scoped token an <img> uses to load a draft's media. */
  MEDIA_TOKEN_MINUTES: z.coerce.number().default(60),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Folder of extra template JSON files, registered at startup. */
  TEMPLATES_EXTRA_DIR: z.string().optional(),
  /** Failed PIN attempts allowed per experience + IP before a lockout kicks in. */
  PIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  /** How long that lockout lasts, in minutes. */
  PIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
  /**
   * A coarser net in front of PIN_MAX_ATTEMPTS: caps /verify calls per IP
   * across ALL experiences (PIN_MAX_ATTEMPTS is per experience+visitor), so
   * one visitor can't dodge a lockout by trying many different letters.
   */
  PIN_VERIFY_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment variables:');
  console.error(result.error.flatten().fieldErrors);
  // A thrown error (rather than process.exit) still ends a real boot the same
  // way — Node exits non-zero on an uncaught exception — but it doesn't tear
  // down a whole test worker just because one spec imported this module
  // without a full .env in scope. Vitest runs many files in shared worker
  // processes; `exit()` here would have killed every test scheduled on that
  // worker, not just this one.
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(result.error.flatten().fieldErrors)}`,
  );
}

export const config = result.data;
export type Config = typeof config;
