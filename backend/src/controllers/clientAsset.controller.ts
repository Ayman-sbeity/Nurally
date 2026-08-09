import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { ClientAsset } from '../models/ClientAsset';
import { ClientPhotoSet } from '../models/ClientPhotoSet';
import { User } from '../models/User';
import * as assetService from '../services/clientAsset.service';
import { AssetKind, UserRole, type PhotoPhase } from '../types/domain';
import { ApiError, ErrorCode } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import { verifyUpload } from '../middleware/upload';

/**
 * Admin-created clients are records, not accounts.
 *
 * The password field is filled with a hash of random bytes nobody holds, which
 * makes the account impossible to sign into rather than merely hard to guess.
 * The client claims it later through the normal forgot-password flow, so staff
 * never handle a client's credentials.
 */
export const createClient = asyncHandler(async (req: Request, res: Response) => {
  const { fullName, email, phone, notes, marketingOptIn } = req.body as {
    fullName: string;
    email: string;
    phone: string;
    notes?: string;
    marketingOptIn: boolean;
  };

  const existing = await User.findOne({ email }).select('_id').lean();
  if (existing) {
    throw ApiError.conflict('That email address is already registered.', ErrorCode.EMAIL_IN_USE);
  }

  const unusablePassword = randomBytes(48).toString('hex');
  const client = await User.create({
    fullName,
    email,
    phone,
    passwordHash: await User.hashPassword(unusablePassword),
    role: UserRole.CLIENT,
    isActive: true,
    clientProfile: {
      ...(notes ? { notes } : {}),
      preferredServices: [],
      marketingOptIn,
    },
  });

  ok(res, { client: client.toJSON() }, 201);
});

// --- Before/after records ---------------------------------------------------

export const listPhotoSets = asyncHandler(async (req: Request, res: Response) => {
  const clientId = await assetService.assertClientExists(req.params.id as string);
  ok(res, { photoSets: await assetService.listPhotoSetsWithPhotos(clientId) });
});

export const createPhotoSet = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const clientId = await assetService.assertClientExists(req.params.id as string);
  const { title, serviceId, appointmentId, takenAt, notes, consentToPublish } = req.body;

  const set = await ClientPhotoSet.create({
    client: clientId,
    title,
    ...(serviceId ? { service: serviceId } : {}),
    ...(appointmentId ? { appointment: appointmentId } : {}),
    takenAt,
    ...(notes ? { notes } : {}),
    consentToPublish,
    // Only stamp the consent moment when consent was actually given.
    ...(consentToPublish ? { consentRecordedAt: new Date() } : {}),
    createdBy: req.user._id,
  });

  ok(res, { photoSet: set.toJSON() }, 201);
});

export const updatePhotoSet = asyncHandler(async (req: Request, res: Response) => {
  const set = await assetService.loadPhotoSet(req.params.setId as string);
  const { title, takenAt, notes, consentToPublish } = req.body;

  if (title !== undefined) set.title = title;
  if (takenAt !== undefined) set.takenAt = takenAt;
  if (notes !== undefined) set.notes = notes;
  if (consentToPublish !== undefined && consentToPublish !== set.consentToPublish) {
    set.consentToPublish = consentToPublish;
    set.consentRecordedAt = consentToPublish ? new Date() : undefined;
  }

  await set.save();
  ok(res, { photoSet: set.toJSON() });
});

export const removePhotoSet = asyncHandler(async (req: Request, res: Response) => {
  const removed = await assetService.deletePhotoSet(req.params.setId as string);
  ok(res, { deletedPhotos: removed });
});

// --- Uploads ----------------------------------------------------------------

export const uploadPhoto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const clientId = await assetService.assertClientExists(req.params.id as string);
  const set = await assetService.loadPhotoSet(req.params.setId as string);

  if (String(set.client) !== String(clientId)) {
    throw ApiError.badRequest('That before/after record belongs to a different client.');
  }

  const upload = verifyUpload(req.file, { imagesOnly: true });
  const asset = await assetService.storeAsset({
    clientId,
    upload,
    kind: AssetKind.PHOTO,
    uploadedBy: req.user._id,
    photoSet: set._id,
    phase: req.body.phase as PhotoPhase,
    caption: req.body.caption,
  });

  ok(res, { asset: asset.toJSON() }, 201);
});

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const clientId = await assetService.assertClientExists(req.params.id as string);

  const upload = verifyUpload(req.file);
  const asset = await assetService.storeAsset({
    clientId,
    upload,
    kind: AssetKind.DOCUMENT,
    uploadedBy: req.user._id,
    caption: req.body.caption,
  });

  ok(res, { asset: asset.toJSON() }, 201);
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const clientId = await assetService.assertClientExists(req.params.id as string);
  const documents = await ClientAsset.find({ client: clientId, kind: AssetKind.DOCUMENT })
    .sort({ createdAt: -1 })
    .lean();
  ok(res, { documents });
});

/**
 * Streams the bytes behind an asset.
 *
 * This is the only way to read an uploaded file: nothing is served statically,
 * so a client photograph cannot be reached without an admin access token. The
 * response is marked private and `nosniff` so it is never cached by a shared
 * proxy nor re-interpreted as another content type.
 */
export const streamAsset = asyncHandler(async (req: Request, res: Response) => {
  const { asset, stream } = await assetService.openAsset(req.params.assetId as string);

  const inline = asset.mimeType.startsWith('image/');
  const safeName = asset.originalName.replace(/["\\\r\n]/g, '_');

  res.setHeader('Content-Type', asset.mimeType);
  res.setHeader('Content-Length', String(asset.sizeBytes));
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  stream.on('error', () => res.destroy());
  stream.pipe(res);
});

export const removeAsset = asyncHandler(async (req: Request, res: Response) => {
  await assetService.deleteAsset(req.params.assetId as string);
  ok(res, { deleted: true });
});
