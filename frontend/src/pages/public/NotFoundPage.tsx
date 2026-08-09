import { Link } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';

export function NotFoundPage() {
  return (
    <>
      <Seo title="Page not found — Nurella Beauty Lounge" noIndex />
      <main
        className="nu-container"
        style={{ minHeight: '80dvh', display: 'grid', placeContent: 'center', textAlign: 'center' }}
      >
        <p className="nu-eyebrow">404</p>
        <h1 className="nu-heading" style={{ marginBlock: 'var(--nu-space-4)' }}>
          This page could not be found.
        </h1>
        <p className="nu-lede" style={{ marginInline: 'auto', marginBottom: 'var(--nu-space-6)' }}>
          The page you are looking for may have moved.
        </p>
        <div className="nu-row" style={{ justifyContent: 'center' }}>
          <Link to="/" className="nu-btn nu-btn--primary">
            Return home
          </Link>
          <Link to="/services" className="nu-btn nu-btn--outline">
            View treatments
          </Link>
        </div>
      </main>
    </>
  );
}

export default NotFoundPage;
