import { api, request } from './client';
import type {
  ApiEnvelope,
  AppNotification,
  Appointment,
  AppointmentStatus,
  Paginated,
  PushConfig,
} from '@/types/api';

export interface ListAppointmentsParams {
  status?: AppointmentStatus[];
  scope?: 'upcoming' | 'past' | 'all';
  search?: string;
  clientId?: string;
  serviceId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function toQuery(params: ListAppointmentsParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (params.status?.length) query.status = params.status.join(',');
  if (params.scope) query.scope = params.scope;
  if (params.search) query.search = params.search;
  if (params.clientId) query.clientId = params.clientId;
  if (params.serviceId) query.serviceId = params.serviceId;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  query.page = params.page ?? 1;
  query.limit = params.limit ?? 20;
  return query;
}

type AppointmentResponse = ApiEnvelope<{ appointment: Appointment }>;

export const bookingApi = {
  create: (payload: { serviceId: string; startAt: string; clientNotes?: string }) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>('/appointments', payload),
    ),

  listMine: (params: ListAppointmentsParams = {}) =>
    request<Paginated<Appointment>>(
      api.get<ApiEnvelope<Paginated<Appointment>>>('/appointments', { params: toQuery(params) }),
    ),

  get: (id: string) =>
    request<{ appointment: Appointment; availableActions: AppointmentStatus[] }>(
      api.get<ApiEnvelope<{ appointment: Appointment; availableActions: AppointmentStatus[] }>>(
        `/appointments/${id}`,
      ),
    ),

  acceptOffer: (id: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/appointments/${id}/accept-time`),
    ),

  declineOffer: (id: string, reason?: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/appointments/${id}/decline-time`, { reason }),
    ),

  requestReschedule: (id: string, payload: { proposedStartAt: string; message?: string }) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/appointments/${id}/reschedule`, payload),
    ),

  cancel: (id: string, reason?: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/appointments/${id}/cancel`, { reason }),
    ),
};

export const notificationApi = {
  list: (unreadOnly = false) =>
    request<{ notifications: AppNotification[]; unreadCount: number }>(
      api.get<ApiEnvelope<{ notifications: AppNotification[]; unreadCount: number }>>(
        '/notifications',
        { params: unreadOnly ? { unreadOnly: 'true' } : {} },
      ),
    ),

  markRead: (id: string) =>
    request<{ message: string }>(
      api.post<ApiEnvelope<{ message: string }>>(`/notifications/${id}/read`),
    ),

  markAllRead: () =>
    request<{ message: string; count: number }>(
      api.post<ApiEnvelope<{ message: string; count: number }>>('/notifications/read-all'),
    ),
};

/** Web Push device registration. */
export const pushApi = {
  config: () =>
    request<PushConfig>(api.get<ApiEnvelope<PushConfig>>('/notifications/push/config')),

  subscribe: (subscription: PushSubscriptionJSON) =>
    request<{ message: string }>(
      api.post<ApiEnvelope<{ message: string }>>('/notifications/push/subscribe', subscription),
    ),

  unsubscribe: (endpoint: string) =>
    request<{ message: string }>(
      api.post<ApiEnvelope<{ message: string }>>('/notifications/push/unsubscribe', { endpoint }),
    ),

  sendTest: () =>
    request<{ message: string; delivered: number }>(
      api.post<ApiEnvelope<{ message: string; delivered: number }>>('/notifications/push/test'),
    ),
};
