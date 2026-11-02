import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env';
import { ApiError, ErrorCode } from '../utils/ApiError';

const handler: Options['handler'] = (_req, _res, next) => {
  next(new ApiError(429, ErrorCode.RATE_LIMITED, 'Too many requests. Please try again shortly.'));
};

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  // Lifting the ceiling in development keeps hot-reload loops from tripping it.
  skip: () => env.NODE_ENV === 'test',
};

/** Broad ceiling applied to the whole API. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 600 : 5000,
});

/** Tight limit on credential endpoints to blunt brute-force attempts. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 10 : 100,
  skipSuccessfulRequests: true,
});

/**
 * AI images are billed per picture. Per person rather than per IP — the whole
 * lounge shares one — so a stuck button or a runaway loop caps one admin's
 * spend without blocking a colleague. Generous for real use: a full catalogue
 * with a retry for each treatment fits in an hour.
 */
export const aiImageLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: env.isProduction ? 120 : 400,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
});

/** Booking submission — prevents a client from spamming requests. */
export const bookingLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: env.isProduction ? 20 : 200,
});
