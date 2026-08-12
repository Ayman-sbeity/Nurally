import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/States';
import { usePermissions } from '@/hooks/usePermissions';
import { firstAllowedAdminPath } from '@/lib/adminNav';
import type { AdminResource, User } from '@/types/api';

/** Where a signed-in user belongs: employees work in the admin, clients in the app. */
export function homePathFor(user: Pick<User, 'role'> | null | undefined): string {
  return user?.role === 'ADMIN' || user?.role === 'STAFF' ? '/admin' : '/app';
}

/**
 * Gate for authenticated areas.
 *
 * While the silent refresh is in flight we render a loader rather than
 * redirecting — otherwise every hard reload would bounce a signed-in user to
 * the login page.
 *
 * `area` rather than an exact role: the admin area holds both the owner and
 * employees, and which *sections* an employee sees is decided by
 * `RequirePermission` on each route below.
 */
export function RequireAuth({ children, area }: { children: ReactNode; area?: 'CLIENT' | 'ADMIN' }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center' }}>
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  const inAdminArea = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const allowed = area === 'ADMIN' ? inAdminArea : area === 'CLIENT' ? !inAdminArea : true;

  if (!allowed) {
    // Someone landing on the wrong side goes to their own home rather than
    // seeing a bare "forbidden" screen.
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <>{children}</>;
}

/**
 * Per-section gate inside the admin.
 *
 * An employee who reaches a URL they were not granted — a bookmark, a link from
 * a colleague, a notification for a section that was since revoked — is moved
 * to the first section they *can* open, so they land somewhere usable instead
 * of on an error.
 */
export function RequirePermission({
  children,
  resource,
}: {
  children: ReactNode;
  resource: AdminResource;
}) {
  const { user } = useAuth();
  const { canView } = usePermissions();

  if (canView(resource)) return <>{children}</>;

  const fallback = firstAllowedAdminPath(user);
  // Nothing at all is granted: an account in this state cannot use the admin,
  // and bouncing it around its own empty sidebar would be a redirect loop.
  if (!fallback) return <NoAdminAccess />;

  return <Navigate to={fallback} replace />;
}

function NoAdminAccess() {
  const { logout } = useAuth();

  return (
    <div className="nu-detail" style={{ display: 'block' }}>
      <section className="nu-panel">
        <div className="nu-panel__head">
          <h1 className="nu-panel__title">No sections assigned</h1>
        </div>
        <div className="nu-panel__body">
          <p className="nu-hint">
            Your account does not yet have access to any part of the admin. Ask the lounge owner to
            grant it from Staff.
          </p>
          <button
            type="button"
            className="nu-btn nu-btn--ghost nu-btn--sm"
            style={{ marginTop: 'var(--nu-space-4)' }}
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

/** Keeps signed-in visitors away from the login/register screens. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={homePathFor(user)} replace />;
  return <>{children}</>;
}

/** Restores scroll position on navigation, which a SPA does not do by default. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}
