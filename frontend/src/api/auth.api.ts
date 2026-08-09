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
