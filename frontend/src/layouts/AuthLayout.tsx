import { Link, Outlet } from 'react-router-dom';
import { BRAND } from '@/content/brand';

/** Quiet, focused frame for sign in / sign up / password recovery. */
export function AuthLayout() {
  return (
    <div className="nu-auth">
      <div className="nu-auth__panel">
        <Link to="/" className="nu-wordmark nu-wordmark--center">
          <span className="nu-wordmark__main">NURELLA</span>
          <span className="nu-wordmark__sub">Beauty Lounge</span>
        </Link>
        <Outlet />
      </div>

      <aside className="nu-auth__aside" aria-hidden="true">
        <div className="nu-auth__aside-inner">
          <p className="nu-eyebrow">{BRAND.name}</p>
          <p className="nu-auth__quote">Beauty, Refined.</p>
          <p className="nu-auth__sub">
            Where advanced aesthetics meet elegance, precision, and personalized care.
          </p>
        </div>
      </aside>
    </div>
  );
}
