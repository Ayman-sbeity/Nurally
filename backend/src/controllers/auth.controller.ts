import type { Request, Response } from 'express';
import { env } from '../config/env';
import { User } from '../models/User';
import * as authService from '../services/auth.service';
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
  const user = await authService.login(req.body.email, req.body.password);
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
