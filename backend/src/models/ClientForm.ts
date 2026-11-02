import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  ClientFormStatus,
  ClientFormType,
  FormLocale,
  SignerRole,
} from '../types/domain';
import { omitInternal } from './serialization';

/**
 * A completed or in-progress clinical form: the health form the client signs,
 * or the provider's record of one session.
 *
 * Both share one collection because their lifecycle is identical — drafted,
 * then signed, then never changed again — and only `type` decides which
 * questions `answers` holds. The answers are validated against that type's
 * schema in `validators/clientForm.validators.ts` before they are ever written,
 * so the loose `Mixed` type here is a storage detail, not an open door.
 *
 * A signed form is immutable. Updating the health form creates a new version
 * rather than editing the signed one, so what a client signed on a given day
 * is always what the record shows for that day.
 */
export interface FormSignature {
  signerName: string;
  signerRole: SignerRole;
  signedAt: Date;
  /** The staff member signed in when the form was signed. */
  recordedBy: Types.ObjectId;
}

export interface ClientFormAttrs {
  client: Types.ObjectId;
  type: ClientFormType;
  locale: FormLocale;
  status: ClientFormStatus;
  /** The client's name when the form was started — a signed form keeps it. */
  clientName: string;
  /** Session records only: the booking this session was for, when there was one. */
  appointment?: Types.ObjectId;
  answers: Record<string, unknown>;
  signature?: FormSignature;
  /**
   * The drawn signature, a PNG data URL of a few tens of kilobytes. Kept apart
   * from `signature` and unselected by default so listings never carry it.
   */
  signatureImage?: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientFormDocument = HydratedDocument<ClientFormAttrs>;

const signatureSchema = new Schema<FormSignature>(
  {
    signerName: { type: String, required: true, trim: true, maxlength: 120 },
    signerRole: { type: String, enum: Object.values(SignerRole), required: true },
    signedAt: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false },
);

const clientFormSchema = new Schema<ClientFormAttrs>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(ClientFormType), required: true },
    locale: { type: String, enum: Object.values(FormLocale), required: true },
    status: {
      type: String,
      enum: Object.values(ClientFormStatus),
      default: ClientFormStatus.DRAFT,
    },
    clientName: { type: String, required: true, trim: true, maxlength: 120 },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    answers: { type: Schema.Types.Mixed, default: () => ({}) },
    signature: { type: signatureSchema },
    signatureImage: { type: String, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    // `answers` keys are ours, never the client's, but `minimize` would still
    // drop an emptied answers object and break "is this answered" checks.
    minimize: false,
    toJSON: { virtuals: true, transform: (_doc, ret) => omitInternal(ret) },
  },
);

// The client page reads every form for one client, newest first.
clientFormSchema.index({ client: 1, createdAt: -1 });

export const ClientForm = model<ClientFormAttrs>('ClientForm', clientFormSchema);
