import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Minutes helper for `z.coerce.number()` fields that must be positive integers.
 */
const positiveInt = z.coerce.number().int().positive();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: positiveInt.default(5000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  SERVER_URL: z.string().url().default('http://localhost:5000'),
  CORS_ORIGINS: z.string().optional(),

  LOUNGE_TIMEZONE: z.string().default('UTC'),
  SLOT_GRANULARITY_MINUTES: positiveInt.default(15),
  MAX_ADVANCE_BOOKING_DAYS: positiveInt.default(60),
  MIN_BOOKING_NOTICE_MINUTES: z.coerce.number().int().nonnegative().default(120),
  TIME_OFFER_EXPIRY_HOURS: positiveInt.default(48),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@nurella.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),
  SEED_ADMIN_NAME: z.string().default('Nurella Admin'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Fail fast: a misconfigured server must never boot into a half-working state.
  throw new Error(`Invalid environment configuration:\n${details}\n\nSee backend/.env.example`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  /** Every origin allowed to call the API with credentials. */
  corsOrigins: [
    raw.CLIENT_URL,
    ...(raw.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
} as const;

export type Env = typeof env;
