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

  /**
   * Client photos and documents. Stored outside the served tree and streamed
   * through an authenticated route — never exposed as static files, because
   * treatment photography is sensitive personal data.
   */
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: positiveInt.default(15),
  /**
   * Reel videos only. A minute of 1080p vertical footage is comfortably more
   * than a photograph, so it gets its own ceiling rather than dragging the
   * image limit up with it.
   */
  MAX_VIDEO_UPLOAD_MB: positiveInt.default(80),

  /**
   * Web Push (VAPID). Optional: without a key pair the app still works and
   * notifications stay in-app only, so a deployment that has not generated
   * keys yet is not a broken one. Generate a pair with `npm run push:keys`.
   */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  /** Contact the push service can reach us at, per the VAPID spec. */
  VAPID_SUBJECT: z.string().default('mailto:admin@nurella.local'),

  /**
   * WhatsApp assistant. Every credential is optional and the feature is simply
   * off without them — the same posture as Web Push above, so a deployment that
   * has not been through the Meta setup is not a broken one. See
   * `docs/WHATSAPP-SETUP-GUIDE.md`.
   */
  WA_TOKEN: z.string().optional(),
  /** The numeric *id* of the number, not the number. They are easy to confuse. */
  WA_PHONE_NUMBER_ID: z.string().optional(),
  WA_WABA_ID: z.string().optional(),
  /** Our own invented string; Meta echoes it back when verifying the webhook. */
  WA_VERIFY_TOKEN: z.string().optional(),
  /**
   * Meta app secret, used to prove an incoming webhook really came from Meta.
   * Optional so local testing through a tunnel stays easy, but a production
   * deployment without it accepts messages from anyone who finds the URL — the
   * server warns loudly at boot.
   */
  WA_APP_SECRET: z.string().optional(),
  WA_GRAPH_VERSION: z.string().default('v21.0'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  /** Turns of history sent to the model. Cost and latency scale with this. */
  WA_HISTORY_TURNS: positiveInt.default(20),
  /** How long the AI stays quiet on a thread after a staff member replies. */
  WA_HANDOFF_MINUTES: positiveInt.default(30),
  /** AI replies one number can trigger per minute, before it is throttled. */
  WA_RATE_LIMIT_PER_MINUTE: positiveInt.default(10),
  /**
   * How long a dormant conversation is kept. Chat history is personal data, so
   * it expires on its own rather than accumulating forever.
   */
  WA_HISTORY_RETENTION_DAYS: positiveInt.default(365),
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
  /**
   * Whether Web Push can actually be sent. Both halves of the key pair are
   * required — a public key alone would let browsers subscribe to a server
   * that can never deliver.
   */
  pushEnabled: Boolean(raw.VAPID_PUBLIC_KEY && raw.VAPID_PRIVATE_KEY),
  /**
   * Whether the WhatsApp assistant can run. All four are required: a token with
   * no model key answers nothing, and a model key with no token has nowhere to
   * answer. Partial configuration keeps the webhook closed rather than half
   * open.
   */
  whatsappEnabled: Boolean(
    raw.WA_TOKEN && raw.WA_PHONE_NUMBER_ID && raw.WA_VERIFY_TOKEN && raw.GEMINI_API_KEY,
  ),
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
