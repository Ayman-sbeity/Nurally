import { Link, NavLink, Outlet } from 'react-router-dom';
import { useNotifications } from '@/hooks/queries';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { initials } from '@/utils/format';

const TABS = [
  { to: '/app', label: 'Home', end: true, icon: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5' },
  { to: '/app/book', label: 'Book', icon: 'M12 5v14M5 12h14' },
  {
    to: '/app/appointments',
    label: 'Appointments',
    icon: 'M7 3v3M17 3v3M3.5 9h17M4 6h16v15H4z',
  },
  { to: '/app/profile', label: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' },
];

function TabIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mobile-first shell for the installable client app. */
export function ClientLayout() {
  const { user } = useAuth();
  const { data } = useNotifications();
  const { canInstall, showIosHint, promptInstall, dismiss } = usePwaInstall();
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="nu-app" data-surface="client">
      <header className="nu-app__header">
        <div className="nu-app__header-inner">
          <Link to="/" className="nu-app__brand" aria-label="Nurella Beauty Lounge — website">
            NURELLA
          </Link>

          <div className="nu-row" style={{ gap: 'var(--nu-space-2)' }}>
            <Link
              to="/app/notifications"
              className="nu-app__icon-btn"
              aria-label={
                unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path
                  d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {unread > 0 && <span className="nu-app__dot" aria-hidden="true" />}
            </Link>

            <Link to="/app/profile" className="nu-app__avatar" aria-label="Your profile">
              {initials(user?.fullName ?? '')}
            </Link>
          </div>
        </div>
      </header>

      {(canInstall || showIosHint) && (
        <div className="nu-install-banner" role="region" aria-label="Install the Nurella app">
          <div>
            <p className="nu-install-banner__title">Add Nurella to your home screen</p>
            <p className="nu-install-banner__body">
              {showIosHint
                ? 'Tap the Share button, then “Add to Home Screen”.'
                : 'Book and check your appointments like a native app.'}
            </p>
          </div>
          <div className="nu-row" style={{ gap: 'var(--nu-space-2)' }}>
            {canInstall && (
              <Button size="sm" variant="gold" onClick={() => void promptInstall()}>
                Install
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Dismiss install prompt">
              Not now
            </Button>
          </div>
        </div>
      )}

      <main className="nu-app__main" id="main">
        <Outlet />
      </main>

      <nav className="nu-tabbar" aria-label="Application">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `nu-tab${isActive ? ' is-active' : ''}`}
          >
            <TabIcon path={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
