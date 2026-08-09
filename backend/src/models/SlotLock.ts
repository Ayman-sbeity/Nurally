import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * DOUBLE-BOOKING PREVENTION
 * -------------------------
 * The bookable day is modelled as a grid of fixed-width cells
 * (`SLOT_GRANULARITY_MINUTES`). An appointment claims every cell its duration
 * covers by inserting one document per cell into this collection.
 *
 * `cellStart` carries a **unique** index, so two concurrent bookings that
 * overlap by even one cell cannot both succeed: the second insert fails with a
 * duplicate-key error and the whole claim is rolled back. This gives real
 * mutual exclusion on a standalone mongod, where multi-document transactions
 * are unavailable — and it keeps working unchanged on a replica set.
 *
 * Only appointments in an occupying status hold cells; rejecting or cancelling
 * releases them immediately (see `slotLock.service.ts`).
 */
export interface SlotLockAttrs {
  /** Start instant of the grid cell, aligned to the granularity. */
  cellStart: Date;
  appointment: Types.ObjectId;
}

export type SlotLockDocument = HydratedDocument<SlotLockAttrs>;

const slotLockSchema = new Schema<SlotLockAttrs>(
  {
    cellStart: { type: Date, required: true, unique: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export const SlotLock = model<SlotLockAttrs>('SlotLock', slotLockSchema);
