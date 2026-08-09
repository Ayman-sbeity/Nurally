/* eslint-disable no-console */

type Level = 'info' | 'warn' | 'error' | 'debug';

const COLOURS: Record<Level, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
};

const RESET = '\x1b[0m';

/**
 * Keys whose values must never reach the logs.
 * Sensitive data in logs is a real leak vector, so redaction happens centrally.
 */
const REDACTED_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'resetToken',
]);

export function redact<T>(value: T, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACTED_KEYS.has(key) ? '[redacted]' : redact(entry, depth + 1);
  }
  return output;
}

function write(level: Level, message: string, meta?: unknown): void {
  const stamp = new Date().toISOString();
  const prefix = `${COLOURS[level]}${level.toUpperCase().padEnd(5)}${RESET} ${stamp}`;
  const target = level === 'error' ? console.error : console.log;

  if (meta === undefined) {
    target(`${prefix} ${message}`);
    return;
  }
  target(`${prefix} ${message}`, meta instanceof Error ? meta : redact(meta));
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') write('debug', message, meta);
  },
};
