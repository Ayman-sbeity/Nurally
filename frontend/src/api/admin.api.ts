import { api, request } from './client';
import { toQuery, type ListAppointmentsParams } from './booking.api';
import type {
  ApiEnvelope,
  Appointment,
  AppointmentStatus,
  BlockedPeriod,
  ClientAsset,
  ClientListItem,
  ClientPhotoSet,
  DashboardData,
  GalleryImage,
  InstagramReel,
  Paginated,
  PhotoPhase,
  Service,
  User,
  WorkingHours,
} from '@/types/api';

type AppointmentResponse = ApiEnvelope<{ appointment: Appointment }>;

/**
 * What the admin sends for a reel. `shortcode` is derived from the permalink by
 * the server, so it is never part of the request.
 */
export type ReelPayload = Omit<InstagramReel, '_id' | 'shortcode'>;

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

  // --- Website media -------------------------------------------------------
  /**
   * Uploads a public image (service photography, gallery artwork) and returns
   * the URL to save on the record being edited. Content-Type is left to the
   * browser so it can add the multipart boundary.
   */
  uploadImage: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ url: string }>(
      api.post<ApiEnvelope<{ url: string }>>('/admin/media/images', body, {
        headers: { 'Content-Type': undefined },
      }),
    );
  },

  /**
   * Uploads a reel video. Videos are large enough that the progress callback is
   * worth wiring up — an admin watching a still button for a minute assumes it
   * is broken and clicks it again.
   */
  uploadVideo: (file: File, onProgress?: (percent: number) => void) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ url: string }>(
      api.post<ApiEnvelope<{ url: string }>>('/admin/media/videos', body, {
        headers: { 'Content-Type': undefined },
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        },
      }),
    );
  },

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

  // --- Instagram reels -----------------------------------------------------
  /** Includes hidden reels, unlike the public endpoint. */
  listReels: () =>
    request<{ reels: InstagramReel[] }>(
      api.get<ApiEnvelope<{ reels: InstagramReel[] }>>('/admin/instagram/reels'),
    ),

  createReel: (payload: ReelPayload) =>
    request<{ reel: InstagramReel }>(
      api.post<ApiEnvelope<{ reel: InstagramReel }>>('/admin/instagram/reels', payload),
    ),

  updateReel: (id: string, payload: Partial<ReelPayload>) =>
    request<{ reel: InstagramReel }>(
      api.patch<ApiEnvelope<{ reel: InstagramReel }>>(`/admin/instagram/reels/${id}`, payload),
    ),

  deleteReel: (id: string) =>
    request<{ message: string }>(
      api.delete<ApiEnvelope<{ message: string }>>(`/admin/instagram/reels/${id}`),
    ),

  // --- Client media --------------------------------------------------------
  createClient: (payload: {
    fullName: string;
    email: string;
    phone: string;
    notes?: string;
    marketingOptIn?: boolean;
  }) => request<{ client: User }>(api.post<ApiEnvelope<{ client: User }>>('/admin/clients', payload)),

  listPhotoSets: (clientId: string) =>
    request<{ photoSets: ClientPhotoSet[] }>(
      api.get<ApiEnvelope<{ photoSets: ClientPhotoSet[] }>>(`/admin/clients/${clientId}/photo-sets`),
    ),

  createPhotoSet: (
    clientId: string,
    payload: { title: string; takenAt: string; serviceId?: string; notes?: string; consentToPublish?: boolean },
  ) =>
    request<{ photoSet: ClientPhotoSet }>(
      api.post<ApiEnvelope<{ photoSet: ClientPhotoSet }>>(
        `/admin/clients/${clientId}/photo-sets`,
        payload,
      ),
    ),

  updatePhotoSet: (
    setId: string,
    payload: { title?: string; takenAt?: string; notes?: string; consentToPublish?: boolean },
  ) =>
    request<{ photoSet: ClientPhotoSet }>(
      api.patch<ApiEnvelope<{ photoSet: ClientPhotoSet }>>(`/admin/photo-sets/${setId}`, payload),
    ),

  deletePhotoSet: (setId: string) =>
    request<{ deletedPhotos: number }>(
      api.delete<ApiEnvelope<{ deletedPhotos: number }>>(`/admin/photo-sets/${setId}`),
    ),

  /**
   * Multipart uploads deliberately omit an explicit Content-Type so the browser
   * sets it along with the multipart boundary — hard-coding it breaks parsing.
   */
  uploadPhoto: (
    clientId: string,
    setId: string,
    file: File,
    payload: { phase: PhotoPhase; caption?: string },
  ) => {
    const body = new FormData();
    body.append('file', file);
    body.append('phase', payload.phase);
    if (payload.caption) body.append('caption', payload.caption);
    return request<{ asset: ClientAsset }>(
      api.post<ApiEnvelope<{ asset: ClientAsset }>>(
        `/admin/clients/${clientId}/photo-sets/${setId}/photos`,
        body,
        { headers: { 'Content-Type': undefined } },
      ),
    );
  },

  listDocuments: (clientId: string) =>
    request<{ documents: ClientAsset[] }>(
      api.get<ApiEnvelope<{ documents: ClientAsset[] }>>(`/admin/clients/${clientId}/documents`),
    ),

  uploadDocument: (clientId: string, file: File, caption?: string) => {
    const body = new FormData();
    body.append('file', file);
    if (caption) body.append('caption', caption);
    return request<{ asset: ClientAsset }>(
      api.post<ApiEnvelope<{ asset: ClientAsset }>>(`/admin/clients/${clientId}/documents`, body, {
        headers: { 'Content-Type': undefined },
      }),
    );
  },

  deleteAsset: (assetId: string) =>
    request<{ deleted: boolean }>(
      api.delete<ApiEnvelope<{ deleted: boolean }>>(`/admin/assets/${assetId}`),
    ),

  /**
   * Fetches an asset's bytes as a blob.
   *
   * Uploaded files are not served statically and the access token lives in
   * memory, so an `<img src>` pointing at the API would arrive unauthenticated.
   * Everything that displays a client photo goes through here instead.
   */
  fetchAssetBlob: async (assetId: string): Promise<Blob> => {
    const response = await api.get<Blob>(`/admin/assets/${assetId}/file`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
