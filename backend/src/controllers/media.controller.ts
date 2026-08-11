import type { Request, Response } from 'express';
import * as mediaService from '../services/media.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import { verifyUpload, verifyVideoUpload } from '../middleware/upload';

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

/** Accepts a reel video from an admin and returns its URL, same as `uploadImage`. */
export const uploadVideo = asyncHandler(async (req: Request, res: Response) => {
  const upload = verifyVideoUpload(req.file);
  const { url } = await mediaService.savePublicVideo(upload);
  ok(res, { url }, 201);
});

/**
 * Serves a reel video, with range support so the player can seek.
 *
 * Public for the same reason the image route is: these are the lounge's own
 * marketing clips, already published on Instagram, and they play on a page
 * visitors read while signed out.
 */
export const streamPublicVideo = asyncHandler(async (req: Request, res: Response) => {
  const path = `${req.params.year}/${req.params.month}/${req.params.file}`;

  let video;
  try {
    video = await mediaService.openPublicVideo(path, req.headers.range);
  } catch (error) {
    if (error instanceof mediaService.RangeNotSatisfiable) {
      res.setHeader('Content-Range', `bytes */${error.sizeBytes}`);
      res.status(416).end();
      return;
    }
    throw error;
  }

  const { stream, contentType, sizeBytes, range, isPartial } = video;

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(range.end - range.start + 1));
  // Advertised even on a full response — a player that cannot see this header
  // treats the source as unseekable.
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (isPartial) res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${sizeBytes}`);

  res.status(isPartial ? 206 : 200);

  // Seeking abandons the previous request mid-flight, so the stream is closed
  // with the response rather than left reading a file nobody is listening to.
  res.on('close', () => stream.destroy());
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});
