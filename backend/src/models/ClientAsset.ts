import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { AssetKind, PhotoPhase } from '../types/domain';
import { omitInternal } from './serialization';

/**
 * Every uploaded byte belonging to a client — photographs and documents alike.
 *
 * One collection rather than two because the lifecycle is identical (upload,
 * stream through an authenticated route, delete with the stored object) and
 * only the `kind` changes how the UI presents it.
 *
 * `storageKey` is opaque and never leaves the server: the API exposes assets by
 * `_id` and streams the bytes, so the storage layout stays private and a client
 * photo can never be fetched by guessing a path.
 */
export interface ClientAssetAttrs {
  client: Types.ObjectId;
  kind: AssetKind;
  /** Set only for photos that belong to a before/after record. */
  photoSet?: Types.ObjectId;
  phase?: PhotoPhase;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  uploadedBy: Types.ObjectId;
}

export type ClientAssetDocument = HydratedDocument<ClientAssetAttrs>;

const clientAssetSchema = new Schema<ClientAssetAttrs>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: Object.values(AssetKind), required: true },
    photoSet: { type: Schema.Types.ObjectId, ref: 'ClientPhotoSet', index: true },
    phase: { type: String, enum: Object.values(PhotoPhase) },
    // `select: false` so the key never rides along on a response by accident.
    storageKey: { type: String, required: true, select: false },
    originalName: { type: String, required: true, trim: true, maxlength: 260 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    caption: { type: String, trim: true, maxlength: 400 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_doc, ret) => omitInternal(ret, ['storageKey']) },
  },
);

// Drives "all documents for this client" and "photos in this set".
clientAssetSchema.index({ client: 1, kind: 1, createdAt: -1 });

export const ClientAsset = model<ClientAssetAttrs>('ClientAsset', clientAssetSchema);
