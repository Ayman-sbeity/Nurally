import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { omitInternal } from './serialization';

/**
 * A closure carved out of the normal schedule: a day off, a holiday, or a
 * blocked range within a day. Stored as absolute instants (UTC) so overlap
 * queries stay simple and timezone-safe.
 */
export interface BlockedPeriodAttrs {
  startAt: Date;
  endAt: Date;
  /** True when the block covers whole days rather than a time range. */
  allDay: boolean;
  reason?: string;
  createdBy: Types.ObjectId;
}

export type BlockedPeriodDocument = HydratedDocument<BlockedPeriodAttrs>;

const blockedPeriodSchema = new Schema<BlockedPeriodAttrs>(
  {
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    allDay: { type: Boolean, default: false },
    reason: { type: String, trim: true, maxlength: 240 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret),
    },
  },
);

// Overlap lookup for a requested day: startAt < dayEnd AND endAt > dayStart.
blockedPeriodSchema.index({ startAt: 1, endAt: 1 });

blockedPeriodSchema.pre('validate', function validateRange(next) {
  if (this.endAt <= this.startAt) {
    next(new Error('Blocked period must end after it starts.'));
    return;
  }
  next();
});

export const BlockedPeriod = model<BlockedPeriodAttrs>('BlockedPeriod', blockedPeriodSchema);
