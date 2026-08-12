import type { Request, Response } from 'express';
import { Service } from '../models/Service';
import * as mediaService from '../services/media.service';
import { isLoungeSide, type ServiceCategorySlug } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import { slugify, uniqueSlug } from '../utils/slugify';

/** Human-facing category names, in the order the landing page presents them. */
export const CATEGORY_LABELS: Record<ServiceCategorySlug, string> = {
  laser: 'Laser',
  'skin-care': 'Skin Care',
  'permanent-makeup': 'Permanent Makeup',
  nails: 'Nails',
  'facial-aesthetics': 'Facial Aesthetics',
  'collagen-biostimulation': 'Collagen & Biostimulation',
  'skin-boosters-rejuvenation': 'Skin Boosters & Rejuvenation',
  'advanced-skin-treatments': 'Advanced Skin Treatments',
  'lifting-contouring': 'Lifting & Contouring',
  'beauty-nails': 'Beauty & Nails',
  piercing: 'Piercing',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as ServiceCategorySlug[];

export const listServices = asyncHandler(async (req: Request, res: Response) => {
  const { category, includeInactive, search } = req.query as {
    category?: ServiceCategorySlug;
    includeInactive?: boolean;
    search?: string;
  };

  // Only an admin may see deactivated services.
  const canSeeInactive = includeInactive && Boolean(req.user) && isLoungeSide(req.user!.role);

  const filter: Record<string, unknown> = {};
  if (!canSeeInactive) filter.isActive = true;
  if (category) filter.category = category;
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const services = await Service.find(filter).sort({ displayOrder: 1, name: 1 }).lean();

  const categories = CATEGORY_ORDER.filter((slug) =>
    services.some((service) => service.category === slug),
  ).map((slug) => ({
    slug,
    label: CATEGORY_LABELS[slug],
    services: services.filter((service) => service.category === slug),
  }));

  ok(res, { services, categories });
});

export const getService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  // Accept either an ObjectId or the human-readable slug.
  const service = /^[0-9a-fA-F]{24}$/.test(id ?? '')
    ? await Service.findById(id).lean()
    : await Service.findOne({ slug: id }).lean();

  if (!service) throw ApiError.notFound('That service could not be found.');
  if (!service.isActive && (!req.user || !isLoungeSide(req.user.role))) {
    throw ApiError.notFound('That service could not be found.');
  }
  ok(res, { service });
});

export const createService = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Service.find().select('slug').lean();
  const slug = uniqueSlug(req.body.name, new Set(existing.map((item) => item.slug)));

  const attrs = { ...req.body, slug };
  // "No image" is the field being absent, never an empty string.
  if (!attrs.imageUrl) delete attrs.imageUrl;

  const service = await Service.create(attrs);
  ok(res, { service }, 201);
});

export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const update: Record<string, unknown> = { ...req.body };

  // An empty string clears the image; Mongo stores the absence, not a blank.
  const clearsImage = update.imageUrl === '';
  if (clearsImage) delete update.imageUrl;

  if (typeof update.name === 'string') {
    const others = await Service.find({ _id: { $ne: req.params.id } }).select('slug').lean();
    const taken = new Set(others.map((item) => item.slug));
    const current = await Service.findById(req.params.id).select('slug').lean();
    // Keep the existing slug when the name change does not alter it — links stay stable.
    if (!current || slugify(update.name) !== current.slug) {
      update.slug = uniqueSlug(update.name, taken);
    }
  }

  const previous = await Service.findById(req.params.id).select('imageUrl').lean();

  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { $set: update, ...(clearsImage ? { $unset: { imageUrl: '' } } : {}) },
    { new: true, runValidators: true },
  );
  if (!service) throw ApiError.notFound('That service could not be found.');

  // The bytes behind a replaced upload are no longer reachable from anywhere,
  // so remove them rather than letting the upload directory grow forever.
  if (previous?.imageUrl && previous.imageUrl !== service.imageUrl) {
    await mediaService.discardServiceImage(previous.imageUrl, { exceptServiceId: service.id });
  }

  ok(res, { service });
});

export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  // Soft delete: existing appointments reference this service, so the record
  // is deactivated rather than removed.
  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true },
  );
  if (!service) throw ApiError.notFound('That service could not be found.');
  ok(res, { service, message: 'Service deactivated.' });
});

export const reorderServices = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: string; displayOrder: number }[] };
  await Service.bulkWrite(
    items.map((item) => ({
      updateOne: { filter: { _id: item.id }, update: { $set: { displayOrder: item.displayOrder } } },
    })),
  );
  ok(res, { message: 'Order updated.' });
});
