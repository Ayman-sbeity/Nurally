import { Service } from '../models/Service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { storage } from './storage';
import type { VerifiedUpload } from '../middleware/upload';

/**
 * Public website media — service photography, and anything else shown to
 * visitors who are not signed in.
 *
 * These files live under their own storage prefix, separate from the client
 * before/after photographs. That separation is the whole point: the route that
 * serves this media is unauthenticated, and it can only ever address keys
 * inside `public/`, so no confidential asset is reachable through it however
 * the request is crafted.
 */
const PUBLIC_PREFIX = 'public';

/** `/api/media/<yyyy>/<mm>/<uuid>.<ext>` — the shape the website renders. */
export const MEDIA_URL_PREFIX = '/api/media';

/**
 * Exactly what `storage.save` produces, nothing looser. Path traversal, dot
 * segments and stray extensions all fail this before touching the filesystem.
 */
const MEDIA_PATH = /^\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Stores an uploaded image and returns the URL the front end should persist. */
export async function savePublicImage(upload: VerifiedUpload): Promise<{ url: string }> {
  const stored = await storage.save(upload.buffer, {
    extension: upload.extension,
    prefix: PUBLIC_PREFIX,
  });
  return { url: toPublicUrl(stored.key) };
}

const toPublicUrl = (key: string) => `${MEDIA_URL_PREFIX}/${key.slice(PUBLIC_PREFIX.length + 1)}`;

/**
 * Reverses `toPublicUrl` for URLs this server issued. Returns null for anything
 * else — an externally hosted image is a perfectly valid `imageUrl`, it simply
 * has no object of ours behind it.
 */
export function toStorageKey(url: string | undefined | null): string | null {
  if (!url?.startsWith(`${MEDIA_URL_PREFIX}/`)) return null;
  const path = url.slice(MEDIA_URL_PREFIX.length + 1);
  return MEDIA_PATH.test(path) ? `${PUBLIC_PREFIX}/${path}` : null;
}

/** Opens a stored image for streaming, given the path segments from the URL. */
export async function openPublicImage(path: string) {
  if (!MEDIA_PATH.test(path)) throw ApiError.notFound('That image could not be found.');

  const key = `${PUBLIC_PREFIX}/${path}`;
  if (!(await storage.exists(key))) throw ApiError.notFound('That image could not be found.');

  const extension = path.slice(path.lastIndexOf('.') + 1);
  return { stream: storage.createReadStream(key), contentType: CONTENT_TYPES[extension] as string };
}

/**
 * Deletes the bytes behind a replaced image, unless another record still points
 * at them. Admins copy URLs between services, and silently breaking the other
 * card would be worse than leaving one orphaned file on disk.
 *
 * Never throws: losing a stale file is not a reason to fail the edit the admin
 * actually asked for.
 */
export async function discardServiceImage(
  url: string | undefined | null,
  options: { exceptServiceId?: string } = {},
): Promise<void> {
  const key = toStorageKey(url);
  if (!key) return;

  try {
    const stillUsed = await Service.exists({
      imageUrl: url,
      ...(options.exceptServiceId ? { _id: { $ne: options.exceptServiceId } } : {}),
    });
    if (stillUsed) return;

    await storage.remove(key);
  } catch (error) {
    logger.warn('Could not discard replaced service image', { key, error: String(error) });
  }
}
