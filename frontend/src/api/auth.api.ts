import { api, request } from './client';
import type { ApiEnvelope, AuthResponse, User } from '@/types/api';

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<AuthResponse>(api.post<ApiEnvelope<AuthResponse>>('/auth/register', payload)),

  login: (email: string, password: string) =>
    request<AuthResponse>(api.post<ApiEnvelope<AuthResponse>>('/auth/login', { email, password })),

  /** Exchanges the httpOnly refresh cookie for a fresh access token. */
  refresh: () => request<AuthResponse>(api.post<ApiEnvelope<AuthResponse>>('/auth/refresh')),

  logout: () => request<{ message: string }>(api.post<ApiEnvelope<{ message: string }>>('/auth/logout')),

  me: () => request<{ user: User }>(api.get<ApiEnvelope<{ user: User }>>('/auth/me')),

  updateProfile: (payload: { fullName?: string; phone?: string; marketingOptIn?: boolean }) =>
    request<{ user: User }>(api.patch<ApiEnvelope<{ user: User }>>('/auth/me', payload)),

  /**
   * Multipart; the field name must match `singleUpload('avatar')` on the API.
   *
   * Content-Type is explicitly cleared so the browser can set it with the
   * multipart boundary. Without this the client's `application/json` default
   * applies, and axios serialises the FormData to JSON — the file silently
   * never leaves the browser.
   */
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return request<{ avatarUpdatedAt: string }>(
      api.post<ApiEnvelope<{ avatarUpdatedAt: string }>>('/auth/me/avatar', form, {
        headers: { 'Content-Type': undefined },
      }),
    );
  },

  removeAvatar: () =>
    request<{ message: string }>(
      api.delete<ApiEnvelope<{ message: string }>>('/auth/me/avatar'),
    ),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>(
      api.post<ApiEnvelope<{ message: string }>>('/auth/change-password', {
        currentPassword,
        newPassword,
      }),
    ),

  forgotPassword: (email: string) =>
    request<{ message: string; resetToken?: string }>(
      api.post<ApiEnvelope<{ message: string; resetToken?: string }>>('/auth/forgot-password', {
        email,
      }),
    ),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>(
      api.post<ApiEnvelope<{ message: string }>>('/auth/reset-password', { token, password }),
    ),
};
