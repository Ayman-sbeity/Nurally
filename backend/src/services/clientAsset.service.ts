import type { Types } from 'mongoose';
import { ClientAsset, type ClientAssetDocument } from '../models/ClientAsset';
import { ClientPhotoSet, type ClientPhotoSetDocument } from '../models/ClientPhotoSet';
import { User } from '../models/User';
import { AssetKind, UserRole, type PhotoPhase } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { storage } from './storage';
import type { VerifiedUpload } from '../middleware/upload';

/** Loads a client or fails — every asset operation is scoped to one client. */
export async function assertClientExists(clientId: string): Promise<Types.ObjectId> {
  const client = await User.findOne({ _id: clientId, role: UserRole.CLIENT })
    .select('_id')
    .lean();
  if (!client) throw ApiError.notFound('That client could not be found.');
  return client._id;
}

export async function loadPhotoSet(setId: string): Promise<ClientPhotoSetDocument> {
  const set = await ClientPhotoSet.findById(setId);
  if (!set) throw ApiError.notFound('That before/after record could not be found.');
  return set;
}

/**
 * Writes the bytes first, then the row.
 *
 * If the database write fails the stored object is removed again, so a failed
 * upload cannot leave an orphaned file on disk. The reverse order would be
 * worse: a row pointing at bytes that were never written renders as a broken
 * image forever.
 */
export async function storeAsset(input: {
  clientId: Types.ObjectId;
  upload: VerifiedUpload;
  kind: AssetKind;
  uploadedBy: Types.ObjectId;
  photoSet?: Types.ObjectId;
  phase?: PhotoPhase;
  caption?: string;
}): Promise<ClientAssetDocument> {
  const stored = await storage.save(input.upload.buffer, { extension: input.upload.extension });

  try {
    return await ClientAsset.create({
      client: input.clientId,
      kind: input.kind,
      ...(input.photoSet ? { photoSet: input.photoSet } : {}),
      ...(input.phase ? { phase: input.phase } : {}),
      storageKey: stored.key,
      originalName: input.upload.originalName,
      mimeType: input.upload.mimeType,
      sizeBytes: stored.sizeBytes,
      ...(input.caption ? { caption: input.caption } : {}),
      uploadedBy: input.uploadedBy,
    });
  } catch (error) {
    await storage.remove(stored.key);
    throw error;
  }
}

/** Removes the row and the bytes behind it. */
export async function deleteAsset(assetId: string): Promise<void> {
  // `storageKey` is `select: false`, so ask for it explicitly.
  const asset = await ClientAsset.findById(assetId).select('+storageKey');
  if (!asset) throw ApiError.notFound('That file could not be found.');

  await asset.deleteOne();
  await storage.remove(asset.storageKey);
}

/** Deletes a before/after record together with every photo inside it. */
export async function deletePhotoSet(setId: string): Promise<number> {
  const set = await loadPhotoSet(setId);
  const photos = await ClientAsset.find({ photoSet: set._id }).select('+storageKey');

  await ClientAsset.deleteMany({ photoSet: set._id });
  await set.deleteOne();

  await Promise.all(photos.map((photo) => storage.remove(photo.storageKey)));
  return photos.length;
}

/**
 * Streams an asset's bytes. Returns the document plus a read stream so the
 * controller can set the right headers.
 */
export async function openAsset(assetId: string) {
  const asset = await ClientAsset.findById(assetId).select('+storageKey');
  if (!asset) throw ApiError.notFound('That file could not be found.');

  if (!(await storage.exists(asset.storageKey))) {
    logger.error('Asset row has no backing object', { assetId, key: asset.storageKey });
    throw ApiError.notFound('That file is no longer available.');
  }

  return { asset, stream: storage.createReadStream(asset.storageKey) };
}

/** Photos for a client, grouped into their before/after records. */
export async function listPhotoSetsWithPhotos(clientId: Types.ObjectId) {
  const sets = await ClientPhotoSet.find({ client: clientId })
    .sort({ takenAt: -1 })
    .populate('service', 'name slug category durationMinutes')
    .lean();

  const photos = await ClientAsset.find({
    client: clientId,
    kind: AssetKind.PHOTO,
    photoSet: { $in: sets.map((set) => set._id) },
  })
    .sort({ createdAt: 1 })
    .lean();

  return sets.map((set) => {
    const inSet = photos.filter((photo) => String(photo.photoSet) === String(set._id));
    return {
      ...set,
      before: inSet.filter((photo) => photo.phase === 'BEFORE'),
      after: inSet.filter((photo) => photo.phase === 'AFTER'),
    };
  });
}
