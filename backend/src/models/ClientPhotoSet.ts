import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { omitInternal } from './serialization';

/**
 * A before/after record for one treatment.
 *
 * Modelled as its own document rather than a pair of loose photos because the
 * context genuinely belongs to the pair, not to either image: the treatment,
 * the date it was taken, and — importantly — the consent under which the
 * photographs may be used. Consent recorded per photo would let a "before" and
 * its "after" disagree.
 *
 * `consentToPublish` defaults to false and is deliberately separate from the
 * client existing in the system at all: photographing a client for their record
 * is not permission to show them on the public gallery.
 */
export interface ClientPhotoSetAttrs {
  client: Types.ObjectId;
  title: string;
  service?: Types.ObjectId;
  appointment?: Types.ObjectId;
  /** When the treatment happened — not when the row was created. */
  takenAt: Date;
  notes?: string;
  consentToPublish: boolean;
  consentRecordedAt?: Date;
  createdBy: Types.ObjectId;
}

export type ClientPhotoSetDocument = HydratedDocument<ClientPhotoSetAttrs>;

const clientPhotoSetSchema = new Schema<ClientPhotoSetAttrs>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    service: { type: Schema.Types.ObjectId, ref: 'Service' },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    takenAt: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    consentToPublish: { type: Boolean, default: false },
    consentRecordedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_doc, ret) => omitInternal(ret) },
  },
);

// The client detail page reads these newest-first for one client.
clientPhotoSetSchema.index({ client: 1, takenAt: -1 });

export const ClientPhotoSet = model<ClientPhotoSetAttrs>('ClientPhotoSet', clientPhotoSetSchema);
