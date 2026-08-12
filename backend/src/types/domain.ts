/**
 * Shared domain vocabulary. Kept free of Mongoose/Express imports so it can be
 * mirrored verbatim by the frontend types.
 */

export const UserRole = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
  /**
   * An employee. Reaches the admin area, but only the sections the owner has
   * granted, and only with the actions granted on each — see `AdminResource`.
   */
  STAFF: 'STAFF',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Whether a role acts on behalf of the lounge rather than as a customer.
 *
 * The booking state machine below is written in terms of these two sides, not
 * individual job titles: a staff member approving an appointment is the lounge
 * approving it. *Which* staff member may do so is decided earlier, by the
 * per-resource permission gate on the route.
 */
export function isLoungeSide(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.STAFF;
}

// ---------------------------------------------------------------------------
// Staff permissions
// ---------------------------------------------------------------------------

/**
 * The admin sections access is granted over. One entry per page in the admin
 * sidebar, so "which pages can this employee open" is a direct translation
 * rather than something the owner has to infer.
 */
export const AdminResource = {
  DASHBOARD: 'DASHBOARD',
  CALENDAR: 'CALENDAR',
  APPOINTMENTS: 'APPOINTMENTS',
  CLIENTS: 'CLIENTS',
  SERVICES: 'SERVICES',
  AVAILABILITY: 'AVAILABILITY',
  GALLERY: 'GALLERY',
  INSTAGRAM: 'INSTAGRAM',
  SETTINGS: 'SETTINGS',
} as const;
export type AdminResource = (typeof AdminResource)[keyof typeof AdminResource];

export const ADMIN_RESOURCES = Object.values(AdminResource);

/**
 * What may be done within a granted section.
 *
 * VIEW is the floor: without it the section is not reachable at all, and the
 * other three are meaningless. `normalizePermissions` enforces that rather than
 * trusting callers to be consistent.
 */
export const PermissionAction = {
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
} as const;
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

export const PERMISSION_ACTIONS = Object.values(PermissionAction);

export interface StaffPermission {
  resource: AdminResource;
  actions: PermissionAction[];
}

/**
 * Sections that are read-only for everyone, so the UI can hide the write
 * checkboxes instead of offering a grant that does nothing. Settings is a view
 * of server environment variables, and the calendar and dashboard are
 * projections of appointments — all four write actions live under APPOINTMENTS.
 */
export const READ_ONLY_RESOURCES: AdminResource[] = [
  AdminResource.DASHBOARD,
  AdminResource.CALENDAR,
  AdminResource.SETTINGS,
];

/**
 * Cleans a permission set coming from the API: drops unknown resources and
 * actions, removes duplicates, discards write actions on read-only sections,
 * and drops any entry that does not grant VIEW.
 */
export function normalizePermissions(input: StaffPermission[]): StaffPermission[] {
  const byResource = new Map<AdminResource, Set<PermissionAction>>();

  for (const entry of input) {
    if (!ADMIN_RESOURCES.includes(entry.resource)) continue;

    const actions = new Set(
      (entry.actions ?? []).filter((action) => PERMISSION_ACTIONS.includes(action)),
    );
    // A grant without VIEW would hide the page while allowing writes to it.
    if (!actions.has(PermissionAction.VIEW)) continue;
    if (READ_ONLY_RESOURCES.includes(entry.resource)) {
      actions.clear();
      actions.add(PermissionAction.VIEW);
    }

    const existing = byResource.get(entry.resource);
    if (existing) actions.forEach((action) => existing.add(action));
    else byResource.set(entry.resource, actions);
  }

  return ADMIN_RESOURCES.filter((resource) => byResource.has(resource)).map((resource) => ({
    resource,
    actions: PERMISSION_ACTIONS.filter((action) => byResource.get(resource)?.has(action)),
  }));
}

/**
 * The single authority on whether a user may do something in the admin area.
 *
 * The owner is unconditionally allowed: an account that could lock itself out
 * of its own lounge would be a worse failure than any it prevents.
 */
export function hasPermission(
  user: { role: UserRole; staffPermissions?: StaffPermission[] },
  resource: AdminResource,
  action: PermissionAction,
): boolean {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role !== UserRole.STAFF) return false;

  const granted = user.staffPermissions?.find((entry) => entry.resource === resource);
  return granted?.actions.includes(action) ?? false;
}

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

/**
 * The table above is written with two actors, CLIENT and ADMIN, because a
 * transition is a move by the client or by the lounge. Staff act for the
 * lounge, so anything the table grants ADMIN is open to them as well — with
 * *which* staff already settled by the permission gate on the route, and their
 * own id recorded in the history either way.
 */
function rolesInclude(roles: UserRole[] | undefined, role: UserRole): boolean {
  if (!roles) return false;
  if (roles.includes(role)) return true;
  return role === UserRole.STAFF && roles.includes(UserRole.ADMIN);
}

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  role: UserRole,
): boolean {
  return rolesInclude(TRANSITIONS[from][to], role);
}

export function allowedTransitions(from: AppointmentStatus, role: UserRole): AppointmentStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [AppointmentStatus, UserRole[]][])
    .filter(([, roles]) => rolesInclude(roles, role))
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
  PIERCING: 'piercing',
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

/** What an uploaded client asset is, which decides how the UI presents it. */
export const AssetKind = {
  PHOTO: 'PHOTO',
  DOCUMENT: 'DOCUMENT',
} as const;
export type AssetKind = (typeof AssetKind)[keyof typeof AssetKind];

/** Which side of a before/after record a photo sits on. */
export const PhotoPhase = {
  BEFORE: 'BEFORE',
  AFTER: 'AFTER',
} as const;
export type PhotoPhase = (typeof PhotoPhase)[keyof typeof PhotoPhase];
