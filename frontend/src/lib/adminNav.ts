import { can } from '@/hooks/usePermissions';
import type { AdminResource, User } from '@/types/api';

/**
 * The admin sidebar, and the single source of truth for which permission opens
 * which page. The route guards read the same list, so a section can never be
 * reachable by URL while hidden from the nav.
 */
export interface AdminNavItem {
  to: string;
  label: string;
  /** The permission that opens it. Absent on always-reachable entries. */
  resource?: AdminResource;
  end?: boolean;
  badge?: 'pending';
  /** Only the lounge owner sees it, whatever an employee has been granted. */
  ownerOnly?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', label: 'Overview', resource: 'DASHBOARD', end: true },
  { to: '/admin/calendar', label: 'Calendar', resource: 'CALENDAR' },
  { to: '/admin/appointments', label: 'Appointments', resource: 'APPOINTMENTS', badge: 'pending' },
  { to: '/admin/clients', label: 'Clients', resource: 'CLIENTS' },
  { to: '/admin/services', label: 'Services', resource: 'SERVICES' },
  { to: '/admin/availability', label: 'Availability', resource: 'AVAILABILITY' },
  { to: '/admin/gallery', label: 'Gallery', resource: 'GALLERY' },
  { to: '/admin/instagram', label: 'Instagram', resource: 'INSTAGRAM' },
  { to: '/admin/staff', label: 'Staff', ownerOnly: true },
  /**
   * No `resource`: Settings is where anyone signed in turns on their own push
   * notifications and checks their own account, so it stays reachable for every
   * employee. The SETTINGS permission gates the booking-engine panel *inside*
   * it, which is the only part that reveals how the lounge is configured.
   */
  { to: '/admin/settings', label: 'Settings' },
];

type Viewer = Pick<User, 'role' | 'staffPermissions'> | null | undefined;

export function isAdminNavItemVisible(item: AdminNavItem, user: Viewer): boolean {
  if (item.ownerOnly) return user?.role === 'ADMIN';
  if (!item.resource) return true;
  return can(user, item.resource, 'VIEW');
}

export function visibleAdminNav(user: Viewer): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => isAdminNavItemVisible(item, user));
}

/**
 * Where to send an employee who lands on a section they cannot open. Settings
 * is always visible, so in practice this only returns null for a user who is
 * not lounge-side at all.
 */
export function firstAllowedAdminPath(user: Viewer): string | null {
  return visibleAdminNav(user)[0]?.to ?? null;
}
