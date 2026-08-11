import type { Readable } from 'node:stream';
import { Service } from '../models/Service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { storage } from './storage';
import type { ByteRange } from './storage';
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

/**
 * Reel videos live in their own sub-area and are served by their own route.
 * Keeping them apart means the image route's path pattern stays as narrow as
 * it is, rather than growing a `mp4` branch that would let a video be
 * requested — and cached — as though it were a photograph.
 */
const VIDEO_PREFIX = 'public/videos';

/** `/api/media/<yyyy>/<mm>/<uuid>.<ext>` — the shape the website renders. */
export const MEDIA_URL_PREFIX = '/api/media';
export const VIDEO_URL_PREFIX = '/api/media/video';

/**
 * Exactly what `storage.save` produces, nothing looser. Path traversal, dot
 * segments and stray extensions all fail this before touching the filesystem.
 */
const uuidPath = (extensions: string) =>
  new RegExp(
    `^\\d{4}/\\d{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${extensions})$`,
  );

const MEDIA_PATH = uuidPath('jpg|png|webp');
const VIDEO_PATH = uuidPath('mp4|webm');

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
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

/** Stores an uploaded reel video and returns the URL to persist on the reel. */
export async function savePublicVideo(upload: VerifiedUpload): Promise<{ url: string }> {
  const stored = await storage.save(upload.buffer, {
    extension: upload.extension,
    prefix: VIDEO_PREFIX,
  });
  return { url: `${VIDEO_URL_PREFIX}/${stored.key.slice(VIDEO_PREFIX.length + 1)}` };
}

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

export interface VideoResponse {
  stream: Readable;
  contentType: string;
  sizeBytes: number;
  /** The slice being sent, always a real sub-range of the file. */
  range: ByteRange;
  /** True when the caller asked for a range and gets a 206 rather than a 200. */
  isPartial: boolean;
}

/**
 * Opens a stored video, honouring a `Range` header.
 *
 * Video playback is range-driven: browsers fetch a little, seek, then ask for
 * the bytes around the new position. Answering the whole file every time would
 * make scrubbing download the reel again, and Safari will not play a source
 * that does not advertise range support at all.
 *
 * Throws `RangeNotSatisfiable` for a syntactically valid range that falls
 * outside the file, which the route turns into a 416 — the response HTTP
 * requires, and the one browsers recover from by re-requesting.
 */
export async function openPublicVideo(path: string, rangeHeader?: string): Promise<VideoResponse> {
  if (!VIDEO_PATH.test(path)) throw ApiError.notFound('That video could not be found.');

  const key = `${VIDEO_PREFIX}/${path}`;
  const sizeBytes = await storage.size(key);
  if (sizeBytes === null) throw ApiError.notFound('That video could not be found.');

  const extension = path.slice(path.lastIndexOf('.') + 1);
  const contentType = CONTENT_TYPES[extension] as string;
  const requested = parseRange(rangeHeader, sizeBytes);

  if (requested === 'unsatisfiable') throw new RangeNotSatisfiable(sizeBytes);

  const range = requested ?? { start: 0, end: Math.max(0, sizeBytes - 1) };
  return {
    stream: storage.createReadStream(key, range),
    contentType,
    sizeBytes,
    range,
    isPartial: requested !== null,
  };
}

export class RangeNotSatisfiable extends Error {
  constructor(readonly sizeBytes: number) {
    super('Requested range not satisfiable');
    this.name = 'RangeNotSatisfiable';
  }
}

/**
 * Reads a single-range `bytes=` header.
 *
 * Multi-range requests are answered in full instead: they are vanishingly rare
 * for video, and a wrong multipart/byteranges response is worse than a
 * correct whole-file one. An empty file has no satisfiable range at all.
 */
function parseRange(header: string | undefined, sizeBytes: number): ByteRange | 'unsatisfiable' | null {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart = '', rawEnd = ''] = match;
  if (rawStart === '' && rawEnd === '') return null;
  if (sizeBytes === 0) return 'unsatisfiable';

  // `bytes=-N` means "the last N bytes", not "from 0 to N".
  const start = rawStart === '' ? Math.max(0, sizeBytes - Number(rawEnd)) : Number(rawStart);
  const end = rawStart === '' || rawEnd === '' ? sizeBytes - 1 : Math.min(Number(rawEnd), sizeBytes - 1);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= sizeBytes) {
    return 'unsatisfiable';
  }
  return { start, end };
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
