import { api, request } from './client';
import { toQuery, type ListAppointmentsParams } from './booking.api';
import type {
  ApiEnvelope,
  Appointment,
  AppointmentStatus,
  BlockedPeriod,
  ClientListItem,
  DashboardData,
  GalleryImage,
  Paginated,
  Service,
  User,
  WorkingHours,
} from '@/types/api';

type AppointmentResponse = ApiEnvelope<{ appointment: Appointment }>;

export const adminApi = {
  // --- Overview ------------------------------------------------------------
  dashboard: () => request<DashboardData>(api.get<ApiEnvelope<DashboardData>>('/admin/dashboard')),

  calendar: (from: string, to: string) =>
    request<{ appointments: Appointment[] }>(
      api.get<ApiEnvelope<{ appointments: Appointment[] }>>('/admin/calendar', {
        params: { from, to },
      }),
    ),

  // --- Appointments --------------------------------------------------------
  listAppointments: (params: ListAppointmentsParams = {}) =>
    request<Paginated<Appointment>>(
      api.get<ApiEnvelope<Paginated<Appointment>>>('/admin/appointments', {
        params: toQuery(params),
      }),
    ),

  getAppointment: (id: string) =>
    request<{ appointment: Appointment; availableActions: AppointmentStatus[] }>(
      api.get<ApiEnvelope<{ appointment: Appointment; availableActions: AppointmentStatus[] }>>(
        `/admin/appointments/${id}`,
      ),
    ),

  approve: (id: string, adminNotes?: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/admin/appointments/${id}/approve`, { adminNotes }),
    ),

  reject: (id: string, reason?: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/admin/appointments/${id}/reject`, { reason }),
    ),

  offerTime: (id: string, payload: { startAt: string; message?: string }) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/admin/appointments/${id}/offer-time`, payload),
    ),

  reschedule: (id: string, payload: { startAt: string; message?: string }) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/admin/appointments/${id}/reschedule`, payload),
    ),

  approveReschedule: (id: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/admin/appointments/${id}/approve-reschedule`),
    ),

  complete: (id: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/admin/appointments/${id}/complete`),
    ),

  noShow: (id: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/admin/appointments/${id}/no-show`),
    ),

  cancel: (id: string, reason?: string) =>
    request<{ appointment: Appointment }>(
      api.post<AppointmentResponse>(`/admin/appointments/${id}/cancel`, { reason }),
    ),

  // --- Clients -------------------------------------------------------------
  listClients: (params: { search?: string; isActive?: boolean; page?: number; limit?: number } = {}) =>
    request<Paginated<ClientListItem>>(
      api.get<ApiEnvelope<Paginated<ClientListItem>>>('/admin/clients', {
        params: {
          ...(params.search ? { search: params.search } : {}),
          ...(params.isActive === undefined ? {} : { isActive: String(params.isActive) }),
          page: params.page ?? 1,
          limit: params.limit ?? 20,
        },
      }),
    ),

  getClient: (id: string) =>
    request<{
      client: User;
      appointments: Appointment[];
      preferredServices: { _id: string; name: string; count: number }[];
    }>(
      api.get<
        ApiEnvelope<{
          client: User;
          appointments: Appointment[];
          preferredServices: { _id: string; name: string; count: number }[];
        }>
      >(`/admin/clients/${id}`),
    ),

  updateClient: (id: string, payload: { notes?: string; isActive?: boolean }) =>
    request<{ client: User }>(
      api.patch<ApiEnvelope<{ client: User }>>(`/admin/clients/${id}`, payload),
    ),

  // --- Services ------------------------------------------------------------
  createService: (payload: Partial<Service> & { name: string; category: string; durationMinutes: number }) =>
    request<{ service: Service }>(
      api.post<ApiEnvelope<{ service: Service }>>('/admin/services', payload),
    ),

  updateService: (id: string, payload: Partial<Service>) =>
    request<{ service: Service }>(
      api.patch<ApiEnvelope<{ service: Service }>>(`/admin/services/${id}`, payload),
    ),

  deactivateService: (id: string) =>
    request<{ service: Service; message: string }>(
      api.delete<ApiEnvelope<{ service: Service; message: string }>>(`/admin/services/${id}`),
    ),

  // --- Availability --------------------------------------------------------
  getWorkingHours: () =>
    request<{ workingHours: WorkingHours[] }>(
      api.get<ApiEnvelope<{ workingHours: WorkingHours[] }>>('/admin/availability/working-hours'),
    ),

  saveWorkingHours: (days: WorkingHours[]) =>
    request<{ workingHours: WorkingHours[] }>(
      api.put<ApiEnvelope<{ workingHours: WorkingHours[] }>>('/admin/availability/working-hours', {
        days: days.map(({ weekday, isOpen, openMinute, closeMinute, breaks }) => ({
          weekday,
          isOpen,
          openMinute,
          closeMinute,
          breaks,
        })),
      }),
    ),

  listBlockedPeriods: (params: { from?: string; to?: string } = {}) =>
    request<{ blockedPeriods: BlockedPeriod[] }>(
      api.get<ApiEnvelope<{ blockedPeriods: BlockedPeriod[] }>>('/admin/availability/blocked', {
        params,
      }),
    ),

  createBlockedPeriod: (payload: {
    startAt: string;
    endAt: string;
    allDay?: boolean;
    reason?: string;
  }) =>
    request<{ blockedPeriod: BlockedPeriod }>(
      api.post<ApiEnvelope<{ blockedPeriod: BlockedPeriod }>>('/admin/availability/blocked', payload),
    ),

  deleteBlockedPeriod: (id: string) =>
    request<{ message: string }>(
      api.delete<ApiEnvelope<{ message: string }>>(`/admin/availability/blocked/${id}`),
    ),

  // --- Gallery -------------------------------------------------------------
  createGalleryImage: (payload: Omit<GalleryImage, '_id'>) =>
    request<{ image: GalleryImage }>(
      api.post<ApiEnvelope<{ image: GalleryImage }>>('/admin/gallery', payload),
    ),

  updateGalleryImage: (id: string, payload: Partial<GalleryImage>) =>
    request<{ image: GalleryImage }>(
      api.patch<ApiEnvelope<{ image: GalleryImage }>>(`/admin/gallery/${id}`, payload),
    ),

  deleteGalleryImage: (id: string) =>
    request<{ message: string }>(
      api.delete<ApiEnvelope<{ message: string }>>(`/admin/gallery/${id}`),
    ),
};
