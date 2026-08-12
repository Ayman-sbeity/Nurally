/**
 * API contract types.
 *
 * These mirror `backend/src/types/domain.ts`. MongoDB documents are identified
 * by `_id` throughout — lean queries omit the `id` virtual, so `_id` is the one
 * field present on every response shape.
 */

export type UserRole = 'CLIENT' | 'ADMIN';

export const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'TIME_OFFERED',
  'RESCHEDULE_REQUESTED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'NO_SHOW',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type ServiceCategorySlug =
  | 'laser'
  | 'skin-care'
  | 'permanent-makeup'
  | 'nails'
  | 'facial-aesthetics'
  | 'collagen-biostimulation'
  | 'skin-boosters-rejuvenation'
  | 'advanced-skin-treatments'
  | 'lifting-contouring'
  | 'beauty-nails'
  | 'piercing';

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  issues?: { field: string; message: string }[];
  details?: Record<string, unknown>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ClientProfile {
  notes?: string;
  preferredServices?: string[];
  marketingOptIn: boolean;
}

export interface User {
  _id: string;
  fullName: string;
  /** Absent for clients identified by phone number alone. */
  email?: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  clientProfile?: ClientProfile;
  /** Present only when the user has a profile photo; also its cache version. */
  avatarUpdatedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientListItem extends User {
  appointmentStats: { total: number; upcoming: number };
}

export interface Service {
  _id: string;
  name: string;
  slug: string;
  category: ServiceCategorySlug;
  description?: string;
  durationMinutes: number;
  /** Absent unless the lounge has configured one — never invented. */
  price?: number;
  currency?: string;
  imageUrl?: string;
  /** 0 = Sunday … 6 = Saturday. Empty means any day the lounge is open. */
  availableWeekdays: number[];
  isActive: boolean;
  displayOrder: number;
}

export interface ServiceCategory {
  slug: ServiceCategorySlug;
  label: string;
  services: Service[];
}

export interface AppointmentHistoryEntry {
  status: AppointmentStatus;
  at: string;
  by?: string;
  byRole: UserRole | 'SYSTEM';
  note?: string;
}

export interface TimeOffer {
  startAt: string;
  message?: string;
  offeredAt: string;
  expiresAt: string;
}

export interface RescheduleRequest {
  proposedStartAt: string;
  message?: string;
  requestedAt: string;
}

/** `client`/`service` arrive populated on list and detail endpoints. */
export interface Appointment {
  _id: string;
  client: Pick<User, '_id' | 'fullName' | 'email' | 'phone'> | string;
  service: Pick<Service, '_id' | 'name' | 'slug' | 'category' | 'durationMinutes' | 'imageUrl'> | string;
  serviceNameSnapshot: string;
  durationMinutes: number;
  requestedStartAt: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  clientNotes?: string;
  adminNotes?: string;
  cancellationReason?: string;
  offer?: TimeOffer;
  rescheduleRequest?: RescheduleRequest;
  history: AppointmentHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  startAt: string;
  label: string;
}

export interface DayAvailability {
  date: string;
  isOpen: boolean;
  closedReason?:
    | 'DAY_OFF'
    | 'BLOCKED'
    | 'FULLY_BOOKED'
    | 'PAST'
    | 'TOO_FAR_AHEAD'
    | 'SERVICE_DAY_OFF';
  /** Present only when the treatment is restricted to particular weekdays. */
  serviceAvailableWeekdays?: number[];
  serviceDurationMinutes: number;
  slots: AvailableSlot[];
  timezone: string;
  maxBookableDate: string;
}

export interface AvailabilityOverviewDay {
  date: string;
  hasSlots: boolean;
  slotCount: number;
}

export interface TimeRange {
  startMinute: number;
  endMinute: number;
}

export interface WorkingHours {
  _id?: string;
  weekday: number;
  isOpen: boolean;
  openMinute: number;
  closeMinute: number;
  breaks: TimeRange[];
}

export interface BlockedPeriod {
  _id: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  reason?: string;
}

export interface BookingSettings {
  timezone: string;
  slotGranularityMinutes: number;
  maxAdvanceBookingDays: number;
  minBookingNoticeMinutes: number;
  maxBookableDate: string;
  workingHours: WorkingHours[];
}

export type NotificationType =
  | 'BOOKING_SUBMITTED'
  | 'BOOKING_APPROVED'
  | 'BOOKING_REJECTED'
  | 'TIME_OFFERED'
  | 'TIME_OFFER_ACCEPTED'
  | 'TIME_OFFER_DECLINED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'RESCHEDULE_REQUESTED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_COMPLETED'
  | 'NEW_BOOKING_REQUEST';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  appointment?: string;
  readAt?: string;
  createdAt: string;
}

/** Whether this deployment can send Web Push, and the key needed to subscribe. */
export interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
  /** How many devices this account has registered. */
  devices: number;
}

export interface GalleryImage {
  _id: string;
  title: string;
  caption?: string;
  imageUrl: string;
  beforeImageUrl?: string;
  category?: ServiceCategorySlug;
  altText: string;
  isActive: boolean;
  displayOrder: number;
}

/**
 * A reel featured on the website. Curated in the admin rather than fetched
 * from Instagram, so the section keeps working without an API token.
 *
 * `videoUrl` present → it plays from our own server. Absent → the viewer falls
 * back to Instagram's embed for that one reel.
 */
export interface InstagramReel {
  _id: string;
  permalink: string;
  shortcode: string;
  caption?: string;
  coverImageUrl: string;
  altText: string;
  videoUrl?: string;
  postedAt?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface DashboardStats {
  todayCount: number;
  pendingCount: number;
  confirmedCount: number;
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
  rejectedCount: number;
  noShowCount: number;
  totalClients: number;
}

export interface DashboardData {
  stats: DashboardStats;
  byStatus: Record<AppointmentStatus, number>;
  todaysAppointments: Appointment[];
  upcomingAppointments: Appointment[];
  pendingRequests: Appointment[];
  popularServices: { _id: string; name: string; count: number }[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// --- Client media ----------------------------------------------------------

export type AssetKind = 'PHOTO' | 'DOCUMENT';
export type PhotoPhase = 'BEFORE' | 'AFTER';

export interface ClientAsset {
  _id: string;
  client: string;
  kind: AssetKind;
  photoSet?: string;
  phase?: PhotoPhase;
  /** Display name only — the stored path is never exposed by the API. */
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A before/after record for one treatment. Consent lives here rather than on
 * the individual photos, so a pair can never half-agree about whether it may
 * be published.
 */
export interface ClientPhotoSet {
  _id: string;
  client: string;
  title: string;
  service?: Service | string;
  appointment?: string;
  takenAt: string;
  notes?: string;
  consentToPublish: boolean;
  consentRecordedAt?: string;
  before: ClientAsset[];
  after: ClientAsset[];
  createdAt: string;
  updatedAt: string;
}
