import type { Request, Response } from 'express';
import { InstagramReel } from '../models/InstagramReel';
import * as instagramService from '../services/instagram.service';
import { UserRole } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import { parseInstagramPermalink } from '../validators/instagram.validators';

/**
 * Turns a validated body into what the model stores.
 *
 * The permalink has already passed the schema, so the parse cannot fail here —
 * but it is re-run rather than trusted, because this is where the canonical
 * form and the shortcode are derived, and the two must always agree.
 */
function toRecord(body: Record<string, unknown>): Record<string, unknown> {
  const record = { ...body };

  if (typeof body.permalink === 'string') {
    const parsed = parseInstagramPermalink(body.permalink);
    if (!parsed) throw ApiError.badRequest('That does not look like an Instagram reel address.');
    record.permalink = parsed.permalink;
    record.shortcode = parsed.shortcode;
  }

  // An empty video URL means "drop the upload and fall back to the embed",
  // which is an unset rather than a stored blank.
  if (record.videoUrl === '') delete record.videoUrl;

  return record;
}

export const listReels = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.user?.role === UserRole.ADMIN ? {} : { isActive: true };

  const reels = await InstagramReel.find(filter).sort({ displayOrder: 1, createdAt: -1 }).lean();
  ok(res, { reels });
});

/**
 * Reads a reel's cover and caption from Instagram so the admin only has to
 * paste a link. Nothing is saved — the response prefills the form, and the
 * admin still decides what is actually featured.
 */
export const lookupReel = asyncHandler(async (req: Request, res: Response) => {
  const { permalink } = req.body as { permalink: string };
  const reel = await instagramService.lookupReel(permalink);

  // Featuring the same reel twice is refused on save; saying so now means the
  // admin does not fill in the rest of the form before finding out.
  const alreadyFeatured = Boolean(await InstagramReel.exists({ shortcode: reel.shortcode }));

  ok(res, { reel, alreadyFeatured });
});

export const createReel = asyncHandler(async (req: Request, res: Response) => {
  const record = toRecord(req.body);

  // The shortcode is unique, so featuring the same reel twice is a conflict
  // rather than a duplicate card in the rail.
  if (await InstagramReel.exists({ shortcode: record.shortcode })) {
    throw ApiError.conflict('That reel is already featured.');
  }

  const reel = await InstagramReel.create(record);
  ok(res, { reel }, 201);
});

export const updateReel = asyncHandler(async (req: Request, res: Response) => {
  const record = toRecord(req.body);

  if (record.shortcode) {
    const clash = await InstagramReel.exists({
      shortcode: record.shortcode,
      _id: { $ne: req.params.id },
    });
    if (clash) throw ApiError.conflict('Another featured reel already points at that address.');
  }

  const reel = await InstagramReel.findByIdAndUpdate(
    req.params.id,
    // `$unset` is what clears an uploaded video; `$set` alone would leave the
    // old URL in place when the field was deliberately emptied.
    {
      $set: record,
      ...(req.body.videoUrl === '' ? { $unset: { videoUrl: '' } } : {}),
    },
    { new: true, runValidators: true },
  );
  if (!reel) throw ApiError.notFound('That reel could not be found.');

  ok(res, { reel });
});

export const deleteReel = asyncHandler(async (req: Request, res: Response) => {
  const reel = await InstagramReel.findByIdAndDelete(req.params.id);
  if (!reel) throw ApiError.notFound('That reel could not be found.');
  ok(res, { message: 'Reel removed.' });
});

export const reorderReels = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: string; displayOrder: number }[] };
  await InstagramReel.bulkWrite(
    items.map((item) => ({
      updateOne: { filter: { _id: item.id }, update: { $set: { displayOrder: item.displayOrder } } },
    })),
  );
  ok(res, { message: 'Order updated.' });
});
