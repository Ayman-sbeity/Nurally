import type { Request, Response } from 'express';
import { env } from '../config/env';
import { verifyUpload } from '../middleware/upload';
import { User } from '../models/User';
import * as authService from '../services/auth.service';
import * as avatarService from '../services/avatar.service';
import { UserRole, isLoungeSide } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '../utils/jwt';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.register(req.body);
  const tokens = authService.issueTokens(user);
  setRefreshCookie(res, tokens.refreshToken);
  ok(res, { user: user.toJSON(), accessToken: tokens.accessToken }, 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.login(req.body.identifier, req.body.password);
  const tokens = authService.issueTokens(user);
  setRefreshCookie(res, tokens.refreshToken);
  ok(res, { user: user.toJSON(), accessToken: tokens.accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw ApiError.unauthorized('No active session.');

  const { user, tokens } = await authService.refreshSession(token);
  setRefreshCookie(res, tokens.refreshToken);
  ok(res, { user: user.toJSON(), accessToken: tokens.accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) await authService.revokeSessions(req.user.id);
  clearRefreshCookie(res);
  ok(res, { message: 'Signed out.' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  ok(res, { user: req.user.toJSON() });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.requestPasswordReset(req.body.email);
  ok(res, {
    message:
      'If an account exists for that email address, a password reset link has been generated.',
    // Development convenience only: there is no mail transport configured yet.
    ...(env.isProduction ? {} : result),
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  clearRefreshCookie(res);
  ok(res, { message: 'Your password has been updated. Please sign in.' });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await authService.changePassword(req.user, req.body.currentPassword, req.body.newPassword);
  clearRefreshCookie(res);
  ok(res, { message: 'Password updated. Please sign in again.' });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { fullName, phone, marketingOptIn } = req.body;
  const update: Record<string, unknown> = {};
  if (fullName !== undefined) update.fullName = fullName;
  if (phone !== undefined) update.phone = phone;
  if (marketingOptIn !== undefined) update['clientProfile.marketingOptIn'] = marketingOptIn;

  const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true });
  if (!user) throw ApiError.notFound('Account not found.');
  ok(res, { user: user.toJSON() });
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  // `imagesOnly` matters here: without it the signature check would happily
  // accept a PDF, and the avatar route would then stream it as a photo.
  const upload = verifyUpload(req.file, { imagesOnly: true });

  // The in-flight user document was loaded without `avatarKey` (select:false),
  // so re-read it — otherwise the previous file would never be discarded.
  const current = await User.findById(req.user.id).select('+avatarKey');
  if (!current) throw ApiError.notFound('Account not found.');

  const avatarUpdatedAt = await avatarService.saveAvatar(current, upload);
  ok(res, { avatarUpdatedAt });
});

export const deleteAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const current = await User.findById(req.user.id).select('+avatarKey');
  if (!current) throw ApiError.notFound('Account not found.');

  await avatarService.removeAvatar(current);
  ok(res, { message: 'Your photo has been removed.' });
});

/**
 * Streams a user's photo to the owner, or to any admin.
 *
 * A client may only ever read their own: without the ownership check, any
 * signed-in client could enumerate user ids and pull other clients' faces.
 */
export const streamAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const targetId = req.params.id as string;
  const isSelf = req.user.id === targetId;
  if (!isSelf && !isLoungeSide(req.user.role)) {
    throw ApiError.forbidden('You may only view your own photo.');
  }

  const target = await User.findById(targetId).select('+avatarKey');
  if (!target?.avatarKey) throw ApiError.notFound('That image could not be found.');

  const { stream, contentType } = await avatarService.openAvatar(target.avatarKey);

  res.setHeader('Content-Type', contentType);
  // Private: the URL is versioned by avatarUpdatedAt, so a long cache is safe,
  // but a shared cache must never hold one user's face for another's request.
  res.setHeader('Cache-Control', 'private, max-age=86400');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});
