import type { Request, Response } from 'express';
import { GalleryImage } from '../models/GalleryImage';
import { isLoungeSide } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';

export const listGallery = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (!req.user || !isLoungeSide(req.user.role)) filter.isActive = true;
  if (typeof req.query.category === 'string') filter.category = req.query.category;

  const images = await GalleryImage.find(filter).sort({ displayOrder: 1, createdAt: -1 }).lean();
  ok(res, { images });
});

export const createGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await GalleryImage.create(req.body);
  ok(res, { image }, 201);
});

export const updateGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await GalleryImage.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true },
  );
  if (!image) throw ApiError.notFound('That image could not be found.');
  ok(res, { image });
});

export const deleteGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await GalleryImage.findByIdAndDelete(req.params.id);
  if (!image) throw ApiError.notFound('That image could not be found.');
  ok(res, { message: 'Image removed.' });
});

export const reorderGallery = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: string; displayOrder: number }[] };
  await GalleryImage.bulkWrite(
    items.map((item) => ({
      updateOne: { filter: { _id: item.id }, update: { $set: { displayOrder: item.displayOrder } } },
    })),
  );
  ok(res, { message: 'Order updated.' });
});
