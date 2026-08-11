import { api, request } from './client';
import type {
  ApiEnvelope,
  AvailabilityOverviewDay,
  BookingSettings,
  DayAvailability,
  GalleryImage,
  InstagramReel,
  Service,
  ServiceCategory,
} from '@/types/api';

export const catalogueApi = {
  listServices: (params?: { category?: string; search?: string; includeInactive?: boolean }) =>
    request<{ services: Service[]; categories: ServiceCategory[] }>(
      api.get<ApiEnvelope<{ services: Service[]; categories: ServiceCategory[] }>>('/services', {
        params: {
          ...(params?.category ? { category: params.category } : {}),
          ...(params?.search ? { search: params.search } : {}),
          ...(params?.includeInactive ? { includeInactive: 'true' } : {}),
        },
      }),
    ),

  /** Accepts an ObjectId or the human-readable slug. */
  getService: (idOrSlug: string) =>
    request<{ service: Service }>(
      api.get<ApiEnvelope<{ service: Service }>>(`/services/${idOrSlug}`),
    ),

  getAvailability: (serviceId: string, date: string) =>
    request<DayAvailability>(
      api.get<ApiEnvelope<DayAvailability>>('/availability', { params: { serviceId, date } }),
    ),

  /** Which of the coming days have openings — drives the date picker. */
  getAvailabilityOverview: (serviceId: string, from: string, days = 14) =>
    request<{ days: AvailabilityOverviewDay[]; maxBookableDate: string }>(
      api.get<ApiEnvelope<{ days: AvailabilityOverviewDay[]; maxBookableDate: string }>>(
        '/availability/overview',
        { params: { serviceId, from, days } },
      ),
    ),

  getBookingSettings: () =>
    request<BookingSettings>(api.get<ApiEnvelope<BookingSettings>>('/availability/settings')),

  listGallery: (category?: string) =>
    request<{ images: GalleryImage[] }>(
      api.get<ApiEnvelope<{ images: GalleryImage[] }>>('/gallery', {
        params: category ? { category } : {},
      }),
    ),

  listReels: () =>
    request<{ reels: InstagramReel[] }>(
      api.get<ApiEnvelope<{ reels: InstagramReel[] }>>('/instagram/reels'),
    ),
};
