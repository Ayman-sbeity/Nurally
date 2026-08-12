import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { bookingApi, notificationApi, type ListAppointmentsParams } from '@/api/booking.api';
import { catalogueApi } from '@/api/catalogue.api';

/**
 * Query keys live in one place so a mutation can invalidate exactly what it
 * affected — no stringly-typed keys scattered through components.
 */
export const qk = {
  services: (params?: Record<string, unknown>) => ['services', params ?? {}] as const,
  service: (idOrSlug: string) => ['service', idOrSlug] as const,
  gallery: (category?: string) => ['gallery', category ?? 'all'] as const,
  reels: (scope: 'public' | 'admin' = 'public') => ['instagram-reels', scope] as const,
  bookingSettings: ['booking-settings'] as const,
  availability: (serviceId: string, date: string) => ['availability', serviceId, date] as const,
  availabilityOverview: (serviceId: string, from: string, days: number) =>
    ['availability-overview', serviceId, from, days] as const,
  myAppointments: (params: ListAppointmentsParams) => ['my-appointments', params] as const,
  appointment: (id: string) => ['appointment', id] as const,
  notifications: ['notifications'] as const,
  adminDashboard: ['admin', 'dashboard'] as const,
  adminCalendar: (from: string, to: string) => ['admin', 'calendar', from, to] as const,
  adminAppointments: (params: ListAppointmentsParams) => ['admin', 'appointments', params] as const,
  adminAppointment: (id: string) => ['admin', 'appointment', id] as const,
  adminClients: (params: Record<string, unknown>) => ['admin', 'clients', params] as const,
  adminClient: (id: string) => ['admin', 'client', id] as const,
  adminAvailability: (serviceId: string, date: string) =>
    ['admin', 'availability', serviceId, date] as const,
  workingHours: ['admin', 'working-hours'] as const,
  blockedPeriods: (params: Record<string, unknown>) => ['admin', 'blocked', params] as const,
  clientPhotoSets: (clientId: string) => ['admin', 'client', clientId, 'photo-sets'] as const,
  clientDocuments: (clientId: string) => ['admin', 'client', clientId, 'documents'] as const,
};

export function useServices(params?: { category?: string; includeInactive?: boolean }) {
  return useQuery({
    queryKey: qk.services(params),
    queryFn: () => catalogueApi.listServices(params),
    // The catalogue rarely changes; a long stale time keeps the landing page snappy.
    staleTime: 10 * 60_000,
  });
}

export function useService(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: qk.service(idOrSlug ?? ''),
    queryFn: () => catalogueApi.getService(idOrSlug as string),
    enabled: Boolean(idOrSlug),
    staleTime: 10 * 60_000,
  });
}

export function useGallery(category?: string) {
  return useQuery({
    queryKey: qk.gallery(category),
    queryFn: () => catalogueApi.listGallery(category),
    staleTime: 10 * 60_000,
  });
}

/**
 * The featured reels. `admin` includes hidden ones and is cached separately, so
 * a reel the admin has just unpublished cannot appear on the public site from
 * a warm cache.
 */
export function useInstagramReels(scope: 'public' | 'admin' = 'public') {
  return useQuery({
    queryKey: qk.reels(scope),
    queryFn: () => (scope === 'admin' ? adminApi.listReels() : catalogueApi.listReels()),
    staleTime: 10 * 60_000,
  });
}

export function useBookingSettings() {
  return useQuery({
    queryKey: qk.bookingSettings,
    queryFn: () => catalogueApi.getBookingSettings(),
    staleTime: 10 * 60_000,
  });
}

export function useAvailability(serviceId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: qk.availability(serviceId ?? '', date ?? ''),
    queryFn: () => catalogueApi.getAvailability(serviceId as string, date as string),
    enabled: Boolean(serviceId && date),
    // Slots are contested: another client may take one at any moment, so this
    // is always refetched on mount rather than served from cache.
    staleTime: 0,
    gcTime: 60_000,
  });
}

export function useAvailabilityOverview(
  serviceId: string | undefined,
  from: string,
  days = 14,
) {
  return useQuery({
    queryKey: qk.availabilityOverview(serviceId ?? '', from, days),
    queryFn: () => catalogueApi.getAvailabilityOverview(serviceId as string, from, days),
    enabled: Boolean(serviceId),
    staleTime: 60_000,
  });
}

export function useMyAppointments(params: ListAppointmentsParams = {}) {
  return useQuery({
    queryKey: qk.myAppointments(params),
    queryFn: () => bookingApi.listMine(params),
  });
}

export function useAppointment(id: string | undefined, asAdmin = false) {
  return useQuery({
    queryKey: asAdmin ? qk.adminAppointment(id ?? '') : qk.appointment(id ?? ''),
    queryFn: () => (asAdmin ? adminApi.getAppointment(id as string) : bookingApi.get(id as string)),
    enabled: Boolean(id),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: () => notificationApi.list(),
    // Booking decisions arrive from the admin side, so poll while the tab is open.
    refetchInterval: 60_000,
  });
}

/**
 * `enabled` lets the sidebar skip the request for an employee who has not been
 * granted the overview — the server would refuse it, and a 403 on every admin
 * screen is noise rather than information.
 */
export function useAdminDashboard(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.adminDashboard,
    queryFn: () => adminApi.dashboard(),
    enabled: options.enabled ?? true,
  });
}

export function useAdminCalendar(from: string, to: string) {
  return useQuery({
    queryKey: qk.adminCalendar(from, to),
    queryFn: () => adminApi.calendar(from, to),
  });
}

export function useAdminAppointments(params: ListAppointmentsParams) {
  return useQuery({
    queryKey: qk.adminAppointments(params),
    queryFn: () => adminApi.listAppointments(params),
  });
}

export function useAdminClients(params: {
  search?: string;
  isActive?: boolean;
  page?: number;
}) {
  return useQuery({
    queryKey: qk.adminClients(params),
    queryFn: () => adminApi.listClients(params),
  });
}

export function useAdminClient(id: string | undefined) {
  return useQuery({
    queryKey: qk.adminClient(id ?? ''),
    queryFn: () => adminApi.getClient(id as string),
    enabled: Boolean(id),
  });
}

export function useClientPhotoSets(clientId: string | undefined) {
  return useQuery({
    queryKey: qk.clientPhotoSets(clientId ?? ''),
    queryFn: () => adminApi.listPhotoSets(clientId as string),
    enabled: Boolean(clientId),
  });
}

export function useClientDocuments(clientId: string | undefined) {
  return useQuery({
    queryKey: qk.clientDocuments(clientId ?? ''),
    queryFn: () => adminApi.listDocuments(clientId as string),
    enabled: Boolean(clientId),
  });
}

/**
 * Bookable slots as staff see them — including the near-term times the
 * minimum-notice rule hides from clients. Kept as contested as the public list:
 * always refetched rather than served from cache.
 */
export function useAdminAvailability(serviceId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: qk.adminAvailability(serviceId ?? '', date ?? ''),
    queryFn: () => adminApi.availability(serviceId as string, date as string),
    enabled: Boolean(serviceId && date),
    staleTime: 0,
    gcTime: 60_000,
  });
}

export function useWorkingHours() {
  return useQuery({ queryKey: qk.workingHours, queryFn: () => adminApi.getWorkingHours() });
}

export function useBlockedPeriods(params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: qk.blockedPeriods(params),
    queryFn: () => adminApi.listBlockedPeriods(params),
  });
}
