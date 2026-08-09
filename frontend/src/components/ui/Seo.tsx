import { useEffect } from 'react';

interface SeoProps {
  title: string;
  description?: string;
  /** Path only, e.g. `/services`. Combined with VITE_SITE_URL. */
  canonicalPath?: string;
  noIndex?: boolean;
}

const SITE_URL = import.meta.env.VITE_SITE_URL ?? window.location.origin;

function setMeta(selector: string, attribute: 'name' | 'property', key: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

/**
 * Per-route document metadata. Small and dependency-free — the landing page is
 * the only page that needs to be indexed, and app routes opt out via `noIndex`.
 */
export function Seo({ title, description, canonicalPath, noIndex }: SeoProps) {
  useEffect(() => {
    document.title = title;

    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      noIndex ? 'noindex, nofollow' : 'index, follow',
    );

    if (canonicalPath) {
      const href = `${SITE_URL.replace(/\/$/, '')}${canonicalPath}`;
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = href;
      setMeta('meta[property="og:url"]', 'property', 'og:url', href);
    }
  }, [title, description, canonicalPath, noIndex]);

  return null;
}
