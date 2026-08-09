import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { APPOINTMENT_STATUSES, AppointmentStatus, UserRole } from '../types/domain';
import { omitInternal } from './serialization';

/** One entry per state change — the appointment's audit trail. */
export interface AppointmentHistoryEntry {
  status: AppointmentStatus;
  at: Date;
  by?: Types.ObjectId;
  byRole: UserRole | 'SYSTEM';
  note?: string;
}

/** Populated when the admin proposes a different time (status TIME_OFFERED). */
export interface TimeOffer {
  startAt: Date;
  message?: string;
  offeredBy: Types.ObjectId;
  offeredAt: Date;
  expiresAt: Date;
}

/** Populated when the client asks for a different time (RESCHEDULE_REQUESTED). */
export interface RescheduleRequest {
  proposedStartAt: Date;
  message?: string;
  requestedAt: Date;
}

export interface AppointmentAttrs {
  client: Types.ObjectId;
  service: Types.ObjectId;
  /**
   * Duration and name are snapshotted at booking time so editing a service
   * later never rewrites the calendar or an existing client's booking.
   */
  serviceNameSnapshot: string;
  durationMinutes: number;

  /** What the client originally asked for. Never mutated. */
  requestedStartAt: Date;
  /** The slot currently held on the calendar. Moves when a time is offered. */
  startAt: Date;
  endAt: Date;

  status: AppointmentStatus;
  clientNotes?: string;
  adminNotes?: string;
  cancellationReason?: string;

  offer?: TimeOffer;
  rescheduleRequest?: RescheduleRequest;

  history: AppointmentHistoryEntry[];
}

export type AppointmentDocument = HydratedDocument<AppointmentAttrs>;

const historySchema = new Schema<AppointmentHistoryEntry>(
  {
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byRole: { type: String, enum: [...Object.values(UserRole), 'SYSTEM'], required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const offerSchema = new Schema<TimeOffer>(
  {
    startAt: { type: Date, required: true },
    message: { type: String, trim: true, maxlength: 500 },
    offeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    offeredAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const rescheduleSchema = new Schema<RescheduleRequest>(
  {
    proposedStartAt: { type: Date, required: true },
    message: { type: String, trim: true, maxlength: 500 },
    requestedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const appointmentSchema = new Schema<AppointmentAttrs>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    serviceNameSnapshot: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 600 },

    requestedStartAt: { type: Date, required: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },

    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: AppointmentStatus.PENDING,
      required: true,
      index: true,
    },
    clientNotes: { type: String, trim: true, maxlength: 1000 },
    adminNotes: { type: String, trim: true, maxlength: 1000 },
    cancellationReason: { type: String, trim: true, maxlength: 500 },

    offer: { type: offerSchema, default: undefined },
    rescheduleRequest: { type: rescheduleSchema, default: undefined },

    history: { type: [historySchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret),
    },
  },
);

// Calendar range queries (admin day/week/month views).
appointmentSchema.index({ startAt: 1, status: 1 });
// "My appointments", newest first.
appointmentSchema.index({ client: 1, startAt: -1 });
// Admin pending-requests queue.
appointmentSchema.index({ status: 1, createdAt: -1 });

export const Appointment = model<AppointmentAttrs>('Appointment', appointmentSchema);
