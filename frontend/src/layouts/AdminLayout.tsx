import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAdminDashboard } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';

const NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/calendar', label: 'Calendar' },
  { to: '/admin/appointments', label: 'Appointments', badge: 'pending' as const },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/services', label: 'Services' },
  { to: '/admin/availability', label: 'Availability' },
  { to: '/admin/gallery', label: 'Gallery' },
  { to: '/admin/instagram', label: 'Instagram' },
  { to: '/admin/settings', label: 'Settings' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const { data } = useAdminDashboard();
  const pendingCount = data?.stats.pendingCount ?? 0;

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
          {NAV.map((item) => (
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
          <p className="nu-hint">{user?.email}</p>
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
