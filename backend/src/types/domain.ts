/**
 * Shared domain vocabulary. Kept free of Mongoose/Express imports so it can be
 * mirrored verbatim by the frontend types.
 */

export const UserRole = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  TIME_OFFERED: 'TIME_OFFERED',
  RESCHEDULE_REQUESTED: 'RESCHEDULE_REQUESTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const APPOINTMENT_STATUSES = Object.values(AppointmentStatus);

/**
 * Statuses whose appointment still occupies the calendar. Only these hold a
 * slot lock; everything else frees the time for other clients.
 */
export const OCCUPYING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.TIME_OFFERED,
  AppointmentStatus.RESCHEDULE_REQUESTED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
];

/** Statuses the appointment can never leave. */
export const TERMINAL_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.REJECTED,
  AppointmentStatus.NO_SHOW,
];

/**
 * The booking state machine.
 *
 * `TRANSITIONS[from][to]` lists the roles allowed to perform that move.
 * Any pair absent from this table is an invalid transition and is rejected by
 * the service layer — the server, not the UI, is the authority here.
 */
export const TRANSITIONS: Record<
  AppointmentStatus,
  Partial<Record<AppointmentStatus, UserRole[]>>
> = {
  [AppointmentStatus.PENDING]: {
    [AppointmentStatus.CONFIRMED]: [UserRole.ADMIN],
    [AppointmentStatus.REJECTED]: [UserRole.ADMIN],
    [AppointmentStatus.TIME_OFFERED]: [UserRole.ADMIN],
    [AppointmentStatus.CANCELLED]: [UserRole.CLIENT, UserRole.ADMIN],
  },
  [AppointmentStatus.TIME_OFFERED]: {
    // Client accepts the proposed time, or the admin confirms it on their behalf.
    [AppointmentStatus.CONFIRMED]: [UserRole.CLIENT, UserRole.ADMIN],
    // Client declines the offer, ending the request.
    [AppointmentStatus.CANCELLED]: [UserRole.CLIENT, UserRole.ADMIN],
    // Client asks for a different time instead of the one proposed.
    [AppointmentStatus.RESCHEDULE_REQUESTED]: [UserRole.CLIENT],
    [AppointmentStatus.REJECTED]: [UserRole.ADMIN],
  },
  [AppointmentStatus.CONFIRMED]: {
    [AppointmentStatus.COMPLETED]: [UserRole.ADMIN],
    [AppointmentStatus.CANCELLED]: [UserRole.CLIENT, UserRole.ADMIN],
    [AppointmentStatus.NO_SHOW]: [UserRole.ADMIN],
    [AppointmentStatus.RESCHEDULE_REQUESTED]: [UserRole.CLIENT],
    // Admin moves a confirmed appointment to a new time they propose.
    [AppointmentStatus.TIME_OFFERED]: [UserRole.ADMIN],
  },
  [AppointmentStatus.RESCHEDULE_REQUESTED]: {
    [AppointmentStatus.CONFIRMED]: [UserRole.ADMIN],
    [AppointmentStatus.TIME_OFFERED]: [UserRole.ADMIN],
    [AppointmentStatus.REJECTED]: [UserRole.ADMIN],
    [AppointmentStatus.CANCELLED]: [UserRole.CLIENT, UserRole.ADMIN],
  },
  [AppointmentStatus.COMPLETED]: {},
  [AppointmentStatus.CANCELLED]: {},
  [AppointmentStatus.REJECTED]: {},
  [AppointmentStatus.NO_SHOW]: {},
};

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  role: UserRole,
): boolean {
  return TRANSITIONS[from][to]?.includes(role) ?? false;
}

export function allowedTransitions(from: AppointmentStatus, role: UserRole): AppointmentStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [AppointmentStatus, UserRole[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([status]) => status);
}

/**
 * Service categories. Order here drives the order shown on the landing page.
 * Names come straight from the Nurella content brief and must not be renamed.
 */
export const ServiceCategorySlug = {
  LASER: 'laser',
  SKIN_CARE: 'skin-care',
  PERMANENT_MAKEUP: 'permanent-makeup',
  NAILS: 'nails',
  FACIAL_AESTHETICS: 'facial-aesthetics',
  COLLAGEN_BIOSTIMULATION: 'collagen-biostimulation',
  SKIN_BOOSTERS_REJUVENATION: 'skin-boosters-rejuvenation',
  ADVANCED_SKIN_TREATMENTS: 'advanced-skin-treatments',
  LIFTING_CONTOURING: 'lifting-contouring',
  BEAUTY_NAILS: 'beauty-nails',
} as const;
export type ServiceCategorySlug =
  (typeof ServiceCategorySlug)[keyof typeof ServiceCategorySlug];

export const NotificationType = {
  BOOKING_SUBMITTED: 'BOOKING_SUBMITTED',
  BOOKING_APPROVED: 'BOOKING_APPROVED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  TIME_OFFERED: 'TIME_OFFERED',
  TIME_OFFER_ACCEPTED: 'TIME_OFFER_ACCEPTED',
  TIME_OFFER_DECLINED: 'TIME_OFFER_DECLINED',
  APPOINTMENT_RESCHEDULED: 'APPOINTMENT_RESCHEDULED',
  RESCHEDULE_REQUESTED: 'RESCHEDULE_REQUESTED',
  APPOINTMENT_CANCELLED: 'APPOINTMENT_CANCELLED',
  APPOINTMENT_COMPLETED: 'APPOINTMENT_COMPLETED',
  NEW_BOOKING_REQUEST: 'NEW_BOOKING_REQUEST',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Delivery channels the notification layer is designed to grow into. */
export const NotificationChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  PUSH: 'PUSH',
} as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];
