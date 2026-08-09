import { Schema, model, type HydratedDocument } from 'mongoose';
import { omitInternal } from './serialization';

export interface TimeRange {
  /** Minutes from midnight, in the lounge timezone. 540 = 09:00 */
  startMinute: number;
  endMinute: number;
}

export interface WorkingHoursAttrs {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  isOpen: boolean;
  openMinute: number;
  closeMinute: number;
  /** Lunch / cleaning breaks carved out of the open window. */
  breaks: TimeRange[];
}

export type WorkingHoursDocument = HydratedDocument<WorkingHoursAttrs>;

const timeRangeSchema = new Schema<TimeRange>(
  {
    startMinute: { type: Number, required: true, min: 0, max: 1440 },
    endMinute: { type: Number, required: true, min: 0, max: 1440 },
  },
  { _id: false },
);

const workingHoursSchema = new Schema<WorkingHoursAttrs>(
  {
    weekday: { type: Number, required: true, min: 0, max: 6, unique: true },
    isOpen: { type: Boolean, default: true },
    openMinute: { type: Number, required: true, min: 0, max: 1440 },
    closeMinute: { type: Number, required: true, min: 0, max: 1440 },
    breaks: { type: [timeRangeSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret),
    },
  },
);

workingHoursSchema.pre('validate', function validateWindow(next) {
  if (this.isOpen && this.closeMinute <= this.openMinute) {
    next(new Error('Closing time must be after opening time.'));
    return;
  }
  for (const brk of this.breaks) {
    if (brk.endMinute <= brk.startMinute) {
      next(new Error('Break end time must be after its start time.'));
      return;
    }
  }
  next();
});

export const WorkingHours = model<WorkingHoursAttrs>('WorkingHours', workingHoursSchema);
