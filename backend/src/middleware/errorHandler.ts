import type { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError, ErrorCode, type FieldIssue } from '../utils/ApiError';
import { logger } from '../utils/logger';

interface MongoServerError extends Error {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

function normalise(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    const issues: FieldIssue[] = error.issues.map((issue) => ({
      field: issue.path.join('.') || '_',
      message: issue.message,
    }));
    return ApiError.badRequest('Please correct the highlighted fields.', issues);
  }

  if (error instanceof MongooseError.ValidationError) {
    const issues: FieldIssue[] = Object.values(error.errors).map((detail) => ({
      field: detail.path,
      message: detail.message,
    }));
    return ApiError.badRequest('Please correct the highlighted fields.', issues);
  }

  if (error instanceof MongooseError.CastError) {
    return ApiError.badRequest(`Invalid value for "${error.path}".`, [
      { field: error.path, message: 'Invalid identifier.' },
    ]);
  }

  const mongoError = error as MongoServerError;
  if (mongoError?.code === 11000) {
    const field = Object.keys(mongoError.keyPattern ?? {})[0] ?? 'field';
    if (field === 'email') {
      return new ApiError(409, ErrorCode.EMAIL_IN_USE, 'That email address is already registered.');
    }
    return ApiError.conflict('That record already exists.');
  }

  return ApiError.internal();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express identifies error middleware by arity.
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const apiError = normalise(error);

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${apiError.statusCode}`, error);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} → ${apiError.statusCode} ${apiError.code}`);
  }

  res.status(apiError.statusCode).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.issues?.length ? { issues: apiError.issues } : {}),
      ...(apiError.details ? { details: apiError.details } : {}),
      // Stack traces are debugging aid only — never in production responses.
      ...(env.isProduction || !(error instanceof Error) ? {} : { stack: error.stack }),
    },
  });
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist.`));
}
