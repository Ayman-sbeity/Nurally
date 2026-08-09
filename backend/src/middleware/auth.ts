import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { User, type UserDocument } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';
import type { UserRole } from '../types/domain';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** Rejects the request unless a valid access token belongs to an active user. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    const token = extractBearerToken(req);
    if (!token) throw ApiError.unauthorized('Please sign in to continue.');

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user) throw ApiError.unauthorized('Your account could not be found.');
    if (!user.isActive) throw ApiError.forbidden('This account has been deactivated.');

    req.user = user;
    next();
  })().catch(next);
};

/** Attaches the user when a token is present, but never blocks the request. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    const token = extractBearerToken(req);
    if (!token) {
      next();
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub);
      if (user?.isActive) req.user = user;
    } catch {
      // An invalid token on an optional route is simply treated as anonymous.
    }
    next();
  })().catch(next);
};

/** Role gate. Must run after `requireAuth`. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(ApiError.unauthorized('Please sign in to continue.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden('You do not have permission to perform this action.'));
      return;
    }
    next();
  };
}
