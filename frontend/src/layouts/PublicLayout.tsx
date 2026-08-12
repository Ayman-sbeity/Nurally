import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { JsonLd } from '@/components/ui/JsonLd';
import { BRAND, instagramUrl } from '@/content/brand';
import { BUSINESS } from '@/content/business';
import { useAuth } from '@/context/AuthContext';
import { useServices } from '@/hooks/queries';
import { businessSchema, webSiteSchema } from '@/lib/geo.js';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Treatments' },
  { to: '/about', label: 'About' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/faq', label: 'FAQ' },
];

export function PublicLayout() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, isLoungeSide } = useAuth();
  const location = useLocation();

  // The catalogue is already cached by the pages that show it; reading it here
  // lets the business graph carry the real treatment menu on every public page.
  const { data: catalogue } = useServices();
  const business = useMemo(
    () => businessSchema(BUSINESS, { categories: catalogue?.categories ?? [] }),
    [catalogue],
  );
  const website = useMemo(() => webSiteSchema(BUSINESS), []);

  // The header goes from transparent (over the hero) to solid once scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const isHome = location.pathname === '/';
  const appHref = isLoungeSide ? '/admin' : '/app';

  return (
    <>
      {/* One business entity for the whole public site, so every page — and
          every AI crawler that reads one of them — resolves to the same @id. */}
      <JsonLd id="business" data={business} />
      <JsonLd id="website" data={website} />

      <a className="nu-skip-link" href="#main">
        Skip to content
      </a>

      <header
        className={`nu-header${scrolled || !isHome ? ' nu-header--solid' : ''}${
          menuOpen ? ' nu-header--open' : ''
        }`}
      >
        <div className="nu-header__inner nu-container">
          <Link to="/" className="nu-wordmark" aria-label={`${BRAND.name} — home`}>
            <span className="nu-wordmark__main">NURELLA</span>
            <span className="nu-wordmark__sub">Beauty Lounge</span>
          </Link>

          <nav className="nu-header__nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `nu-navlink${isActive ? ' is-active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="nu-header__actions">
            {isAuthenticated ? (
              <Link to={appHref} className="nu-btn nu-btn--outline nu-btn--sm">
                {isLoungeSide ? 'Dashboard' : 'My appointments'}
              </Link>
            ) : (
              <Link to="/login" className="nu-navlink nu-header__signin">
                Sign in
              </Link>
            )}
            <Link to="/booking" className="nu-btn nu-btn--primary nu-btn--sm">
              Book now
            </Link>
          </div>

          <button
            type="button"
            className="nu-burger"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <div id="mobile-menu" className={`nu-mobile-menu${menuOpen ? ' is-open' : ''}`} hidden={!menuOpen}>
        <nav aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="nu-mobile-menu__link">
              {link.label}
            </NavLink>
          ))}
          <Link to={isAuthenticated ? appHref : '/login'} className="nu-mobile-menu__link">
            {isAuthenticated ? (isLoungeSide ? 'Dashboard' : 'My appointments') : 'Sign in'}
          </Link>
        </nav>
        <Link to="/booking" className="nu-btn nu-btn--primary nu-btn--block">
          Book now
        </Link>
      </div>

      <main id="main">
        <Outlet />
      </main>

      <footer className="nu-footer">
        <div className="nu-container">
          <div className="nu-footer__top">
            <div>
              <p className="nu-footer__brand">{BRAND.name}</p>
              <p className="nu-footer__tagline">{BRAND.tagline}</p>

              {/* NAP block. Name is always shown; address, phone, email and
                  hours appear only once configured, and must then match the
                  Google Business Profile and social bios exactly — see
                  docs/GEO-NAP-AUDIT.md. */}
              <address className="nu-footer__nap">
                {BUSINESS.addressLine && <span>{BUSINESS.addressLine}</span>}
                {BUSINESS.telephone && (
                  <a href={`tel:${BUSINESS.telephone.replace(/\s+/g, '')}`}>{BUSINESS.telephone}</a>
                )}
                {BUSINESS.email && <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>}
                {BUSINESS.hoursLine && <span>{BUSINESS.hoursLine}</span>}
              </address>
            </div>
            <nav className="nu-footer__nav" aria-label="Footer">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))}
              <Link to="/booking">Book an appointment</Link>
              <a href={instagramUrl} target="_blank" rel="noreferrer noopener">
                @{BRAND.instagramHandle}
              </a>
            </nav>
          </div>
          <hr className="nu-rule" />
          <p className="nu-footer__legal">
            © {new Date().getFullYear()} {BRAND.name}
          </p>
        </div>
      </footer>
    </>
  );
}
