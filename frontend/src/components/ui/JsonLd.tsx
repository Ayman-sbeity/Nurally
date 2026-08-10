import { useEffect } from 'react';

interface JsonLdProps {
  /**
   * Unique per page-role (e.g. `service`, `breadcrumb`). Scripts are keyed by
   * it, so navigating between two service pages replaces the old graph instead
   * of stacking a second, stale one in the head.
   */
  id: string;
  data: unknown;
}

const ATTRIBUTE = 'data-geo';

/**
 * Injects one JSON-LD block into `<head>` for the lifetime of the route.
 *
 * The pre-rendered HTML written by `scripts/prerender.mjs` already carries the
 * same graph for crawlers that do not run JavaScript; this is what keeps it
 * correct for crawlers (and rich-results tools) that do.
 */
export function JsonLd({ id, data }: JsonLdProps) {
  useEffect(() => {
    if (!data) return undefined;

    const selector = `script[type="application/ld+json"][${ATTRIBUTE}="${id}"]`;
    let script = document.head.querySelector<HTMLScriptElement>(selector);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(ATTRIBUTE, id);
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);

    return () => {
      script?.remove();
    };
  }, [id, data]);

  return null;
}
