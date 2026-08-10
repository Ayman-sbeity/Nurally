/**
 * Images uploaded through the admin are stored as the path `/api/media/…`
 * rather than an absolute address, so a record survives the site moving to a
 * new domain. That path resolves against the website's own origin, which is
 * right for the usual same-origin deployment but wrong when the API is hosted
 * elsewhere — so re-point it at the configured API base in that case.
 *
 * Anything else (an external https:// image, a file in `public/`) is returned
 * untouched.
 */
export function mediaSrc(url: string): string {
  if (!url.startsWith('/api/')) return url;

  const base = import.meta.env.VITE_API_URL;
  if (!base || !/^https?:\/\//i.test(base)) return url;

  return `${base.replace(/\/+$/, '')}${url.slice('/api'.length)}`;
}
