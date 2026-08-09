/**
 * Machine-readable error codes. The frontend switches on these to render the
 * right empty/error state, so they are part of the API contract.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCodeValue;
  readonly issues: FieldIssue[] | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    statusCode: number,
    code: ErrorCodeValue,
    message: string,
    options: { issues?: FieldIssue[]; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.issues = options.issues;
    this.details = options.details;
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message: string, issues?: FieldIssue[]): ApiError {
    return new ApiError(400, ErrorCode.VALIDATION_ERROR, message, { issues: issues ?? [] });
  }

  static unauthorized(message = 'Authentication is required.'): ApiError {
    return new ApiError(401, ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message = 'You do not have access to this resource.'): ApiError {
    return new ApiError(403, ErrorCode.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found.'): ApiError {
    return new ApiError(404, ErrorCode.NOT_FOUND, message);
  }

  static conflict(message: string, code: ErrorCodeValue = ErrorCode.CONFLICT): ApiError {
    return new ApiError(409, code, message);
  }

  static internal(message = 'Something went wrong. Please try again.'): ApiError {
    return new ApiError(500, ErrorCode.INTERNAL_ERROR, message);
  }
}
