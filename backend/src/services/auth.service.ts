import crypto from 'node:crypto';
import { env } from '../config/env';
import { User, type UserDocument } from '../models/User';
import { UserRole } from '../types/domain';
import { ApiError, ErrorCode } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';

const RESET_TOKEN_TTL_MINUTES = 30;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function issueTokens(user: UserDocument): AuthTokens {
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: signRefreshToken({ sub: user.id, version: user.tokenVersion }),
  };
}

export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

/**
 * Registration always creates a CLIENT. Admin accounts are provisioned through
 * the seed script — the public API can never mint elevated privileges.
 */
export async function register(input: RegisterInput): Promise<UserDocument> {
  const existing = await User.findOne({ email: input.email.toLowerCase() }).select('_id').lean();
  if (existing) {
    throw new ApiError(409, ErrorCode.EMAIL_IN_USE, 'That email address is already registered.');
  }

  const passwordHash = await User.hashPassword(input.password);
  return User.create({
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    phone: input.phone,
    passwordHash,
    role: UserRole.CLIENT,
    clientProfile: {},
  });
}

export async function login(email: string, password: string): Promise<UserDocument> {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  // Same error and roughly the same work for "no such user" and "wrong
  // password", so the response cannot be used to enumerate accounts.
  if (!user) {
    await User.hashPassword(password);
    throw new ApiError(401, ErrorCode.INVALID_CREDENTIALS, 'Incorrect email or password.');
  }

  const matches = await user.comparePassword(password);
  if (!matches) {
    throw new ApiError(401, ErrorCode.INVALID_CREDENTIALS, 'Incorrect email or password.');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Please contact the lounge.');
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function refreshSession(refreshToken: string): Promise<{
  user: UserDocument;
  tokens: AuthTokens;
}> {
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) throw ApiError.unauthorized('Please sign in again.');
  if (user.tokenVersion !== payload.version) {
    throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.');
  }

  return { user, tokens: issueTokens(user) };
}

/** Invalidates every outstanding refresh token for the account. */
export async function revokeSessions(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

export async function changePassword(
  user: UserDocument,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const withHash = await User.findById(user.id).select('+passwordHash');
  if (!withHash) throw ApiError.notFound('Account not found.');

  const matches = await withHash.comparePassword(currentPassword);
  if (!matches) {
    throw new ApiError(401, ErrorCode.INVALID_CREDENTIALS, 'Your current password is incorrect.');
  }

  withHash.passwordHash = await User.hashPassword(newPassword);
  withHash.tokenVersion += 1; // sign out other devices
  await withHash.save();
}

const hashResetToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Issues a password-reset token.
 *
 * No email provider is configured, so the token is not delivered anywhere. In
 * development it is returned/logged so the flow is testable end to end; in
 * production it is withheld until a mail transport is wired up.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ resetToken?: string }> {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always report success — revealing which addresses exist is an information leak.
  if (!user) return {};

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashResetToken(rawToken);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);
  await user.save();

  if (env.isProduction) {
    logger.warn('Password reset requested but no mail transport is configured.');
    return {};
  }

  logger.info(`[dev] Password reset token for ${user.email}: ${rawToken}`);
  return { resetToken: rawToken };
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const user = await User.findOne({
    passwordResetTokenHash: hashResetToken(rawToken),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) {
    throw ApiError.badRequest('This reset link is invalid or has expired.');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.tokenVersion += 1;
  await user.save();
}
