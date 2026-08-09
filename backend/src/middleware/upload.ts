import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

/**
 * Uploads are buffered in memory, validated, then handed to the storage
 * adapter. Files are small (a photo or a PDF) and capped by `MAX_UPLOAD_MB`, so
 * this avoids temp files that would otherwise need cleaning up on every error
 * path — and it means nothing ever lands on disk before it has been checked.
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

export interface VerifiedUpload {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  originalName: string;
  sizeBytes: number;
}

const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 12, fields: 20 },
});

/** Accepts one file under the given field name. */
export const singleUpload = (field: string) => (req: Request, res: Response, next: NextFunction) => {
  memoryUpload.single(field)(req, res, (error: unknown) => {
    if (error) return next(translateMulterError(error));
    next();
  });
};

/** Accepts several files under the given field name. */
export const multiUpload = (field: string, max = 12) =>
  (req: Request, res: Response, next: NextFunction) => {
    memoryUpload.array(field, max)(req, res, (error: unknown) => {
      if (error) return next(translateMulterError(error));
      next();
    });
  };

function translateMulterError(error: unknown): ApiError {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return ApiError.badRequest(`Each file must be ${env.MAX_UPLOAD_MB} MB or smaller.`);
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

  return {
    buffer: file.buffer,
    mimeType: format.mimeType,
    extension: format.extension,
    // Kept for display and download only — it never influences the stored path.
    originalName: file.originalname.slice(0, 260),
    sizeBytes: file.size,
  };
}
