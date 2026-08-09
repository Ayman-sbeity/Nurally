import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/States';

/**
 * Gate for authenticated areas.
 *
 * While the silent refresh is in flight we render a loader rather than
 * redirecting — otherwise every hard reload would bounce a signed-in user to
 * the login page.
 */
export function RequireAuth({ children, role }: { children: ReactNode; role?: 'CLIENT' | 'ADMIN' }) {
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

  if (role && user?.role !== role) {
    // An admin landing on a client route (or vice versa) goes to their own home
    // rather than seeing a bare "forbidden" screen.
    return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/app'} replace />;
  }

  return <>{children}</>;
}

/** Keeps signed-in visitors away from the login/register screens. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/app'} replace />;
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
