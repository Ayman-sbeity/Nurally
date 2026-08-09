import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiEnvelope, ApiErrorPayload } from '@/types/api';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * The access token is held in memory only.
 *
 * Persisting it to localStorage would expose it to any XSS on the page; the
 * long-lived refresh token instead lives in an httpOnly cookie the browser
 * attaches automatically, and a page reload silently re-mints an access token
 * from it (see `AuthProvider`).
 */
let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Lets the auth layer clear its state when a refresh finally fails. */
export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler;
}

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/** A raw client for the refresh call itself, so it can never recurse. */
const refreshClient = axios.create({ baseURL: BASE_URL, withCredentials: true });

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Concurrent 401s share one refresh request rather than stampeding the API.
  refreshPromise ??= refreshClient
    .post<ApiEnvelope<{ accessToken: string }>>('/auth/refresh')
    .then((response) => {
      const token = response.data.data.accessToken;
      accessToken = token;
      return token;
    })
    .catch(() => {
      accessToken = null;
      onUnauthenticated?.();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: ApiErrorPayload }>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const isAuthEndpoint = config?.url?.startsWith('/auth/');
    if (status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      }
    }

    return Promise.reject(error);
  },
);

/** Normalised error the UI can render without touching Axios internals. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues: { field: string; message: string }[];

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message);
    this.name = 'ApiRequestError';
    this.code = payload.code;
    this.status = status;
    this.issues = payload.issues ?? [];
  }
}

export function toApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;

  if (axios.isAxiosError(error)) {
    const payload = (error.response?.data as { error?: ApiErrorPayload } | undefined)?.error;
    if (payload) return new ApiRequestError(payload, error.response?.status ?? 500);

    if (error.code === 'ECONNABORTED') {
      return new ApiRequestError(
        { code: 'TIMEOUT', message: 'The request timed out. Please try again.' },
        408,
      );
    }
    return new ApiRequestError(
      {
        code: 'NETWORK_ERROR',
        message: 'We could not reach the lounge. Please check your connection and try again.',
      },
      0,
    );
  }

  return new ApiRequestError(
    { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' },
    500,
  );
}

/** Unwraps the `{ success, data }` envelope and normalises failures. */
export async function request<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise;
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}
