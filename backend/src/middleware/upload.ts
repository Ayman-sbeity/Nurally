import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

/**
 * Uploads are buffered in memory, validated, then handed to the storage
 * adapter. Files are small (a photo or a PDF) and capped by `MAX_UPLOAD_MB`, so
 * this avoids temp files that would otherwise need cleaning up on every error
 * path — and it means nothing ever lands on disk before it has been checked.
 *
 * Reel videos are the one exception to "small", and they get their own limit
 * (`MAX_VIDEO_UPLOAD_MB`) and their own uploader. They are still buffered: the
 * ceiling is tens of megabytes, an admin posts a handful of reels a month, and
 * the same rule has to hold for them as for everything else — the bytes are
 * checked before anything is written.
 */

interface FormatSpec {
  mimeType: string;
  extension: string;
  /** Returns true when the buffer really is this format. */
  matches(buffer: Buffer): boolean;
}

const startsWith = (buffer: Buffer, bytes: number[]): boolean =>
  buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

/**
 * Signatures, not file extensions and not the browser-supplied Content-Type —
 * both are attacker-controlled. A `.jpg` that is actually an HTML document is
 * the classic stored-XSS vector, so the bytes decide.
 */
const FORMATS: FormatSpec[] = [
  {
    mimeType: 'image/jpeg',
    extension: '.jpg',
    matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  },
  {
    mimeType: 'image/png',
    extension: '.png',
    matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    mimeType: 'image/webp',
    extension: '.webp',
    // RIFF....WEBP — the size field sits between the two markers.
    matches: (b) =>
      b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    mimeType: 'application/pdf',
    extension: '.pdf',
    matches: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  },
];

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Web-playable video only.
 *
 * MP4 is an ISO base media file: bytes 4–8 spell `ftyp` and the four that
 * follow name the brand. QuickTime (`qt  `) shares that container but not the
 * codecs browsers decode, so the brand list is an allowlist rather than a check
 * for `ftyp` alone — a `.mov` renamed to `.mp4` would otherwise be stored and
 * then refuse to play for every visitor.
 */
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ']);

const VIDEO_FORMATS: FormatSpec[] = [
  {
    mimeType: 'video/mp4',
    extension: '.mp4',
    matches: (b) =>
      b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp' && MP4_BRANDS.has(b.toString('ascii', 8, 12)),
  },
  {
    mimeType: 'video/webm',
    extension: '.webm',
    // EBML header — the container Matroska and WebM share.
    matches: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  },
];

export interface VerifiedUpload {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  originalName: string;
  sizeBytes: number;
}

const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
const maxVideoBytes = env.MAX_VIDEO_UPLOAD_MB * 1024 * 1024;

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 12, fields: 20 },
});

const memoryVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxVideoBytes, files: 1, fields: 20 },
});

/** Accepts one file under the given field name. */
export const singleUpload = (field: string) => (req: Request, res: Response, next: NextFunction) => {
  memoryUpload.single(field)(req, res, (error: unknown) => {
    if (error) return next(translateMulterError(error, env.MAX_UPLOAD_MB));
    next();
  });
};

/** Accepts one video, under the larger `MAX_VIDEO_UPLOAD_MB` ceiling. */
export const singleVideoUpload = (field: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    memoryVideoUpload.single(field)(req, res, (error: unknown) => {
      if (error) return next(translateMulterError(error, env.MAX_VIDEO_UPLOAD_MB));
      next();
    });
  };

/** Accepts several files under the given field name. */
export const multiUpload = (field: string, max = 12) =>
  (req: Request, res: Response, next: NextFunction) => {
    memoryUpload.array(field, max)(req, res, (error: unknown) => {
      if (error) return next(translateMulterError(error, env.MAX_UPLOAD_MB));
      next();
    });
  };

function translateMulterError(error: unknown, limitMb: number): ApiError {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return ApiError.badRequest(`Each file must be ${limitMb} MB or smaller.`);
    }
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      return ApiError.badRequest('Too many files in one upload.');
    }
    return ApiError.badRequest(`Upload rejected: ${error.message}`);
  }
  return ApiError.badRequest('That upload could not be read.');
}

/**
 * Confirms the bytes match a format we accept and returns the canonical type.
 * The caller passes `imagesOnly` for photo endpoints so a PDF cannot be filed
 * as a before/after photograph.
 */
export function verifyUpload(
  file: Express.Multer.File | undefined,
  options: { imagesOnly?: boolean } = {},
): VerifiedUpload {
  if (!file) throw ApiError.badRequest('No file was uploaded.');
  if (file.size === 0) throw ApiError.badRequest('That file is empty.');

  const format = FORMATS.find((candidate) => candidate.matches(file.buffer));
  if (!format) {
    throw ApiError.badRequest('Unsupported file type. Upload a JPEG, PNG, WebP or PDF.');
  }
  if (options.imagesOnly && !IMAGE_MIME_TYPES.has(format.mimeType)) {
    throw ApiError.badRequest('Photos must be a JPEG, PNG or WebP image.');
  }

  return describe(file, format);
}

/**
 * The same signature check for reel videos. Kept separate from `verifyUpload`
 * so no image endpoint can ever be talked into accepting a 60 MB file by
 * passing a flag.
 */
export function verifyVideoUpload(file: Express.Multer.File | undefined): VerifiedUpload {
  if (!file) throw ApiError.badRequest('No file was uploaded.');
  if (file.size === 0) throw ApiError.badRequest('That file is empty.');

  const format = VIDEO_FORMATS.find((candidate) => candidate.matches(file.buffer));
  if (!format) {
    throw ApiError.badRequest('Videos must be an MP4 (H.264) or WebM file that a browser can play.');
  }

  return describe(file, format);
}

const describe = (file: Express.Multer.File, format: FormatSpec): VerifiedUpload => ({
  buffer: file.buffer,
  mimeType: format.mimeType,
  extension: format.extension,
  // Kept for display and download only — it never influences the stored path.
  originalName: file.originalname.slice(0, 260),
  sizeBytes: file.size,
});
