import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAdminDashboard } from '@/hooks/queries';
import { usePermissions } from '@/hooks/usePermissions';
import { visibleAdminNav } from '@/lib/adminNav';
import { Button } from '@/components/ui/Button';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { canView, isOwner } = usePermissions();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // The pending badge is the only thing the sidebar reads from the dashboard,
  // so an employee without sight of appointments should not be fetching it.
  const canSeeAppointments = canView('APPOINTMENTS');
  const { data } = useAdminDashboard({ enabled: canView('DASHBOARD') && canSeeAppointments });
  const pendingCount = data?.stats.pendingCount ?? 0;

  const nav = visibleAdminNav(user);

  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className="nu-admin" data-surface="admin">
      <aside className={`nu-admin__sidebar${navOpen ? ' is-open' : ''}`}>
        <div className="nu-admin__sidebar-head">
          <Link to="/admin" className="nu-wordmark">
            <span className="nu-wordmark__main">NURELLA</span>
            <span className="nu-wordmark__sub">Admin</span>
          </Link>
        </div>

        <nav className="nu-admin__nav" aria-label="Admin sections">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nu-admin__navlink${isActive ? ' is-active' : ''}`}
            >
              <span>{item.label}</span>
              {/* Pending requests are the one thing that needs chasing, so the
                  count follows the admin around the dashboard. */}
              {item.badge === 'pending' && pendingCount > 0 && (
                <span className="nu-admin__count">{pendingCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="nu-admin__sidebar-foot">
          <p className="nu-admin__user">{user?.fullName}</p>
          {/* An employee sees a limited sidebar; naming their role explains why
              rather than leaving them to wonder what is missing. */}
          <p className="nu-hint">{isOwner ? user?.email : (user?.jobTitle ?? 'Team member')}</p>
          <div className="nu-row" style={{ marginTop: 'var(--nu-space-3)', gap: 'var(--nu-space-2)' }}>
            <Link to="/" className="nu-btn nu-btn--ghost nu-btn--sm">
              View site
            </Link>
            <Button size="sm" variant="ghost" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {navOpen && (
        <button
          type="button"
          className="nu-admin__scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="nu-admin__body">
        <header className="nu-admin__topbar">
          <button
            type="button"
            className="nu-burger nu-burger--dark"
            aria-expanded={navOpen}
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
          <span className="nu-admin__topbar-title">Nurella Admin</span>
        </header>

        <main className="nu-admin__main" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
