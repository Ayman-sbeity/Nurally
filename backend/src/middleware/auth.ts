import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { User, type UserDocument } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';
import {
  UserRole,
  hasPermission,
  isLoungeSide,
  type AdminResource,
  type PermissionAction,
} from '../types/domain';

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

/**
 * Admits the owner and employees to the admin area. Deliberately coarse — it
 * only establishes that the caller is lounge-side, and says nothing about what
 * they may reach. Every route pairs it with `requirePermission`, which is where
 * an employee's access is actually decided.
 */
export const requireAdminArea: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(ApiError.unauthorized('Please sign in to continue.'));
    return;
  }
  if (!isLoungeSide(req.user.role)) {
    next(ApiError.forbidden('You do not have permission to perform this action.'));
    return;
  }
  next();
};

/**
 * Per-section gate: the server-side authority on what an employee may do.
 *
 * The admin UI hides what it cannot use, but that is a courtesy — a staff
 * account that crafts the request by hand is stopped here.
 */
export function requirePermission(
  resource: AdminResource,
  action: PermissionAction,
): PermissionHandler {
  const handler: PermissionHandler = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(ApiError.unauthorized('Please sign in to continue.'));
      return;
    }
    if (!hasPermission(req.user, resource, action)) {
      next(
        ApiError.forbidden(
          'Your account does not have permission for this. Ask the lounge owner to grant it.',
        ),
      );
      return;
    }
    next();
  };

  // Tagged so the route table can be audited: `npm run audit:permissions`
  // walks the admin router and fails if any route is left ungated. Without the
  // tag these are anonymous closures and indistinguishable from any other
  // middleware.
  handler.permission = { resource, action };
  return handler;
}

export interface PermissionHandler extends RequestHandler {
  permission?: { resource: AdminResource; action: PermissionAction };
}

/** Restricts a route to the owner, whatever an employee has been granted. */
export const requireOwner: PermissionHandler = requireRole(UserRole.ADMIN);
requireOwner.permission = { resource: 'OWNER_ONLY' as AdminResource, action: 'ALL' as PermissionAction };
