import { buffer as readAll } from 'node:stream/consumers';
import type { Types } from 'mongoose';
import { ClientAsset, type ClientAssetDocument, type VariantKeys } from '../models/ClientAsset';
import { ClientPhotoSet, type ClientPhotoSetDocument } from '../models/ClientPhotoSet';
import { User } from '../models/User';
import { AssetKind, AssetVariant, UserRole, type PhotoPhase } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { signAssetUrl } from './assetUrl.service';
import { renderVariants, type RenderedVariants } from './image.service';
import { storage } from './storage';
import type { VerifiedUpload } from '../middleware/upload';

const isImage = (mimeType: string) => mimeType.startsWith('image/');

/** Every stored object behind an asset row — remove all of them with the row. */
export function storedKeysOf(asset: { storageKey: string; variantKeys?: VariantKeys | null }): string[] {
  return asset.variantKeys
    ? [asset.storageKey, asset.variantKeys.thumb, asset.variantKeys.display]
    : [asset.storageKey];
}

/**
 * An asset as the admin API returns it: the row, plus signed URLs for showing
 * it when it is an image. See `assetUrl.service.ts` for why images are reached
 * through signed URLs rather than the bearer-token route.
 */
export function presentAsset<T extends { _id: Types.ObjectId | string; mimeType: string }>(
  asset: T,
): T & { urls?: Record<AssetVariant, string> } {
  if (!isImage(asset.mimeType)) return asset;

  const id = String(asset._id);
  const now = Date.now();
  return {
    ...asset,
    urls: {
      thumb: signAssetUrl(id, AssetVariant.THUMB, now),
      display: signAssetUrl(id, AssetVariant.DISPLAY, now),
    },
  };
}

/** Writes both variants, removing the first again if the second fails. */
async function saveVariants(rendered: RenderedVariants): Promise<VariantKeys> {
  const thumb = await storage.save(rendered.thumb.buffer, { extension: rendered.thumb.extension });
  try {
    const display = await storage.save(rendered.display.buffer, { extension: rendered.display.extension });
    return { thumb: thumb.key, display: display.key };
  } catch (error) {
    await storage.remove(thumb.key);
    throw error;
  }
}

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
 *
 * Images are decoded and their variants rendered before anything is written,
 * so an unreadable image is refused without touching storage at all.
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
  const rendered = isImage(input.upload.mimeType) ? await renderVariants(input.upload.buffer) : null;

  const stored = await storage.save(input.upload.buffer, { extension: input.upload.extension });
  let variantKeys: VariantKeys | undefined;

  try {
    if (rendered) variantKeys = await saveVariants(rendered);

    return await ClientAsset.create({
      client: input.clientId,
      kind: input.kind,
      ...(input.photoSet ? { photoSet: input.photoSet } : {}),
      ...(input.phase ? { phase: input.phase } : {}),
      storageKey: stored.key,
      originalName: input.upload.originalName,
      mimeType: input.upload.mimeType,
      sizeBytes: stored.sizeBytes,
      ...(rendered ? { width: rendered.width, height: rendered.height, variantKeys } : {}),
      ...(input.caption ? { caption: input.caption } : {}),
      uploadedBy: input.uploadedBy,
    });
  } catch (error) {
    await Promise.all(storedKeysOf({ storageKey: stored.key, variantKeys }).map((key) => storage.remove(key)));
    throw error;
  }
}

/** Removes the row and the bytes behind it. */
export async function deleteAsset(assetId: string): Promise<void> {
  // The keys are `select: false`, so ask for them explicitly.
  const asset = await ClientAsset.findById(assetId).select('+storageKey +variantKeys');
  if (!asset) throw ApiError.notFound('That file could not be found.');

  await asset.deleteOne();
  await Promise.all(storedKeysOf(asset).map((key) => storage.remove(key)));
}

/** Deletes a before/after record together with every photo inside it. */
export async function deletePhotoSet(setId: string): Promise<number> {
  const set = await loadPhotoSet(setId);
  const photos = await ClientAsset.find({ photoSet: set._id }).select('+storageKey +variantKeys');

  await ClientAsset.deleteMany({ photoSet: set._id });
  await set.deleteOne();

  await Promise.all(photos.flatMap(storedKeysOf).map((key) => storage.remove(key)));
  return photos.length;
}

/**
 * Renders in progress, by asset id. A legacy photo is usually asked for twice
 * at once — its thumbnail, and a hover prefetch of its preview — and both
 * requests should wait on one render rather than each writing their own copy.
 */
const backfills = new Map<string, Promise<VariantKeys>>();

/**
 * Photos uploaded before variants existed have only their original. The first
 * request for one renders its variants and files them on the row, so the cost
 * is paid once per photo, by whoever happens to open that client first.
 */
function backfillVariants(asset: { _id: Types.ObjectId; storageKey: string }): Promise<VariantKeys> {
  const id = String(asset._id);
  const running = backfills.get(id);
  if (running) return running;

  const render = (async () => {
    if (!(await storage.exists(asset.storageKey))) {
      logger.error('Asset row has no backing object', { assetId: id, key: asset.storageKey });
      throw ApiError.notFound('That photo is no longer available.');
    }

    const original = await readAll(storage.createReadStream(asset.storageKey));
    const rendered = await renderVariants(original);
    const variantKeys = await saveVariants(rendered);

    // Conditional, so a second server process that got there first — or a
    // delete that landed mid-render — wins, and our copies are discarded
    // rather than orphaned.
    const { matchedCount } = await ClientAsset.updateOne(
      { _id: asset._id, variantKeys: { $exists: false } },
      { $set: { variantKeys, width: rendered.width, height: rendered.height } },
    );
    if (matchedCount === 1) return variantKeys;

    await Promise.all([variantKeys.thumb, variantKeys.display].map((key) => storage.remove(key)));
    const current = await ClientAsset.findById(asset._id).select('+variantKeys').lean();
    if (!current?.variantKeys) throw ApiError.notFound('That photo could not be found.');
    return current.variantKeys;
  })().finally(() => backfills.delete(id));

  backfills.set(id, render);
  return render;
}

/** Opens one variant of an image asset for streaming. */
export async function openVariant(assetId: string, variant: AssetVariant) {
  const asset = await ClientAsset.findById(assetId).select('+storageKey +variantKeys').lean();
  if (!asset || !isImage(asset.mimeType)) throw ApiError.notFound('That photo could not be found.');

  const keys = asset.variantKeys ?? (await backfillVariants(asset));
  const key = keys[variant];

  const sizeBytes = await storage.size(key);
  if (sizeBytes === null) {
    logger.error('Asset variant has no backing object', { assetId, variant, key });
    throw ApiError.notFound('That photo is no longer available.');
  }

  return { stream: storage.createReadStream(key), sizeBytes };
}

/**
 * Streams an asset's original bytes. Returns the document plus a read stream so
 * the controller can set the right headers.
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
    const inSet = photos.filter((photo) => String(photo.photoSet) === String(set._id)).map(presentAsset);
    return {
      ...set,
      before: inSet.filter((photo) => photo.phase === 'BEFORE'),
      after: inSet.filter((photo) => photo.phase === 'AFTER'),
    };
  });
}
