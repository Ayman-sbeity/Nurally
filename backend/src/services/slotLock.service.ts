import type { Types } from 'mongoose';
import { env } from '../config/env';
import { SlotLock } from '../models/SlotLock';
import { ApiError, ErrorCode } from '../utils/ApiError';
import { gridCellsFor } from '../utils/time';

const GRANULARITY = env.SLOT_GRANULARITY_MINUTES;

function isDuplicateKeyError(error: unknown): boolean {
  const candidate = error as { code?: number; writeErrors?: { code?: number }[] };
  if (candidate?.code === 11000) return true;
  return Boolean(candidate?.writeErrors?.some((writeError) => writeError.code === 11000));
}

const bookingConflict = (): ApiError =>
  ApiError.conflict(
    'That time was just taken by another booking. Please choose a different slot.',
    ErrorCode.BOOKING_CONFLICT,
  );

/**
 * Claims every grid cell the appointment covers.
 *
 * The unique index on `cellStart` is what makes this safe under concurrency:
 * whichever request inserts a given cell first wins, and the loser's partial
 * inserts are rolled back here before the conflict is reported.
 */
export async function acquireSlot(
  appointmentId: Types.ObjectId,
  startAt: Date,
  durationMinutes: number,
): Promise<void> {
  const cells = gridCellsFor(startAt, durationMinutes, GRANULARITY);

  try {
    await SlotLock.insertMany(
      cells.map((cellStart) => ({ cellStart, appointment: appointmentId })),
      { ordered: false },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // Roll back: only cells carrying *our* appointment id were inserted by us,
    // so this can never delete another booking's claim.
    await SlotLock.deleteMany({ appointment: appointmentId, cellStart: { $in: cells } });
    throw bookingConflict();
  }
}

/** Frees every cell held by the appointment. Safe to call when none are held. */
export async function releaseSlot(appointmentId: Types.ObjectId): Promise<void> {
  await SlotLock.deleteMany({ appointment: appointmentId });
}

/**
 * Moves an appointment to a new time.
 *
 * The new cells are claimed **before** the old ones are released, so a failed
 * move never costs the client the slot they already held.
 */
export async function moveSlot(
  appointmentId: Types.ObjectId,
  newStartAt: Date,
  durationMinutes: number,
): Promise<void> {
  const held = await SlotLock.find({ appointment: appointmentId }).select('cellStart').lean();
  const heldMs = new Set(held.map((lock) => lock.cellStart.getTime()));

  const targetCells = gridCellsFor(newStartAt, durationMinutes, GRANULARITY);
  const targetMs = new Set(targetCells.map((cell) => cell.getTime()));

  const cellsToAdd = targetCells.filter((cell) => !heldMs.has(cell.getTime()));
  const cellsToRemove = held
    .map((lock) => lock.cellStart)
    .filter((cell) => !targetMs.has(cell.getTime()));

  if (cellsToAdd.length > 0) {
    try {
      await SlotLock.insertMany(
        cellsToAdd.map((cellStart) => ({ cellStart, appointment: appointmentId })),
        { ordered: false },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      await SlotLock.deleteMany({ appointment: appointmentId, cellStart: { $in: cellsToAdd } });
      throw bookingConflict();
    }
  }

  if (cellsToRemove.length > 0) {
    await SlotLock.deleteMany({ appointment: appointmentId, cellStart: { $in: cellsToRemove } });
  }
}

/**
 * Cell starts already claimed within `[from, to)`, optionally ignoring one
 * appointment's own claims (used when re-timing an existing booking).
 */
export async function getOccupiedCells(
  from: Date,
  to: Date,
  excludeAppointmentId?: Types.ObjectId,
): Promise<Set<number>> {
  const filter: Record<string, unknown> = { cellStart: { $gte: from, $lt: to } };
  if (excludeAppointmentId) filter.appointment = { $ne: excludeAppointmentId };

  const locks = await SlotLock.find(filter).select('cellStart').lean();
  return new Set(locks.map((lock) => lock.cellStart.getTime()));
}
