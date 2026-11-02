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

const prefetched = new Set<string>();

/**
 * Starts downloading an image the user is about to open.
 *
 * Called on hover, focus or the start of a tap — a few hundred milliseconds
 * before the click lands, which is most of a preview's download on a decent
 * connection. The browser caches the response, so the `<img>` that follows is
 * served from that cache rather than starting from nothing.
 *
 * `decode()` holds the request open until the image is ready; a failure is
 * forgotten so the next hover can try again.
 */
export function prefetchImage(url: string): void {
  const src = mediaSrc(url);
  if (prefetched.has(src)) return;
  prefetched.add(src);

  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  image.decode().catch(() => prefetched.delete(src));
}
