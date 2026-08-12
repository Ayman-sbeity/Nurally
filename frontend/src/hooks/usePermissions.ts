import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { AdminResource, PermissionAction, User } from '@/types/api';

/**
 * ADMIN PERMISSIONS (CLIENT SIDE)
 * -------------------------------
 * Mirrors `hasPermission` in `backend/src/types/domain.ts`.
 *
 * This is presentation only. Hiding a button the employee cannot use is a
 * courtesy that keeps the admin honest about what it offers — it is not the
 * protection. Every route re-checks the same rule server-side, so a stale
 * bundle or a hand-made request gains nothing.
 */
export function can(
  user: Pick<User, 'role' | 'staffPermissions'> | null | undefined,
  resource: AdminResource,
  action: PermissionAction,
): boolean {
  if (!user) return false;
  // The owner is allowed everything, and holds no permission rows to consult.
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'STAFF') return false;

  const granted = user.staffPermissions?.find((entry) => entry.resource === resource);
  return granted?.actions.includes(action) ?? false;
}

export function usePermissions() {
  const { user } = useAuth();

  const check = useCallback(
    (resource: AdminResource, action: PermissionAction) => can(user, resource, action),
    [user],
  );

  return useMemo(
    () => ({
      can: check,
      /** Shorthand for the most common test: may this section be opened at all? */
      canView: (resource: AdminResource) => check(resource, 'VIEW'),
      isOwner: user?.role === 'ADMIN',
      isStaff: user?.role === 'STAFF',
    }),
    [check, user?.role],
  );
}
