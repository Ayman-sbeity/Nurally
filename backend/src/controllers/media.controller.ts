import type { Request, Response } from 'express';
import * as mediaService from '../services/media.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import { verifyUpload } from '../middleware/upload';

/**
 * Accepts a website image from an admin and returns its URL.
 *
 * The upload is only stored — nothing is attached to a record here. The caller
 * saves the returned URL onto whatever it is editing (a service, a gallery
 * entry), which keeps one uploader serving every image field in the admin.
 */
export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  // `imagesOnly` — a PDF must never end up rendered as service photography.
  const upload = verifyUpload(req.file, { imagesOnly: true });
  const { url } = await mediaService.savePublicImage(upload);
  ok(res, { url }, 201);
});

/**
 * Serves a public image.
 *
 * Deliberately unauthenticated: these files are the website's own artwork and
 * appear on pages visitors read while signed out. Keys are random UUIDs and
 * content is never overwritten, so the response is safe to cache immutably.
 */
export const streamPublicImage = asyncHandler(async (req: Request, res: Response) => {
  const path = `${req.params.year}/${req.params.month}/${req.params.file}`;
  const { stream, contentType } = await mediaService.openPublicImage(path);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  stream.on('error', () => res.destroy());
  stream.pipe(res);
});
