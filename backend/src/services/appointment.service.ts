import { Types } from 'mongoose';
import { env } from '../config/env';
import { Appointment, type AppointmentDocument } from '../models/Appointment';
import { User } from '../models/User';
import {
  AppointmentStatus,
  NotificationType,
  TERMINAL_STATUSES,
  UserRole,
  canTransition,
  isLoungeSide,
} from '../types/domain';
import { ApiError, ErrorCode } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { formatInLoungeZone, isOnGrid } from '../utils/time';
import {
  assertSlotIsBookable,
  getServiceForBooking,
  serviceWeekdaysFor,
} from './availability.service';
import { createNotification, notifyAdmins } from './notification.service';
import { acquireSlot, moveSlot, releaseSlot } from './slotLock.service';

export interface Actor {
  id: Types.ObjectId;
  role: UserRole;
}

const GRANULARITY = env.SLOT_GRANULARITY_MINUTES;

/** e.g. `Hydra facial — Mon, 10 Aug 2026 at 14:30` */
function describe(appointment: AppointmentDocument, at: Date = appointment.startAt): string {
  return `${appointment.serviceNameSnapshot} — ${formatInLoungeZone(at, "EEE, d MMM yyyy 'at' HH:mm")}`;
}

function pushHistory(
  appointment: AppointmentDocument,
  status: AppointmentStatus,
  actor: Actor | 'SYSTEM',
  note?: string,
): void {
  appointment.history.push({
    status,
    at: new Date(),
    ...(actor === 'SYSTEM' ? {} : { by: actor.id }),
    byRole: actor === 'SYSTEM' ? 'SYSTEM' : actor.role,
    ...(note ? { note } : {}),
  });
}

/** Enforces the state machine. Anything not in the transition table is refused. */
function assertTransition(
  appointment: AppointmentDocument,
  next: AppointmentStatus,
  actor: Actor,
): void {
  if (!canTransition(appointment.status, next, actor.role)) {
    throw new ApiError(
      409,
      ErrorCode.INVALID_TRANSITION,
      `An appointment that is ${appointment.status.toLowerCase().replace(/_/g, ' ')} cannot be changed to ${next
        .toLowerCase()
        .replace(/_/g, ' ')}.`,
      { details: { from: appointment.status, to: next } },
    );
  }
}

function assertOwnership(appointment: AppointmentDocument, actor: Actor): void {
  // Lounge-side actors work across every client's appointments; whether this
  // employee may touch appointments at all was settled on the route.
  if (isLoungeSide(actor.role)) return;
  if (!appointment.client.equals(actor.id)) {
    throw ApiError.forbidden('This appointment does not belong to your account.');
  }
}

function parseStartAt(value: string, field = 'startAt'): Date {
  const startAt = new Date(value);
  if (Number.isNaN(startAt.getTime())) {
    throw ApiError.badRequest('Please provide a valid date and time.', [
      { field, message: 'Invalid date/time.' },
    ]);
  }
  if (!isOnGrid(startAt, GRANULARITY)) {
    throw ApiError.badRequest(`Appointments start on ${GRANULARITY}-minute boundaries.`, [
      { field, message: `Must align to a ${GRANULARITY}-minute slot.` },
    ]);
  }
  return startAt;
}

export async function loadAppointment(
  appointmentId: string,
  actor: Actor,
): Promise<AppointmentDocument> {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('That appointment could not be found.');
  assertOwnership(appointment, actor);
  return appointment;
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

export interface CreateBookingInput {
  serviceId: string;
  startAt: string;
  clientNotes?: string;
}

/**
 * Creates a booking request. Never returns a confirmed appointment — the lounge
 * approves it separately, which is the whole point of the workflow.
 */
export async function createBooking(
  clientId: Types.ObjectId,
  input: CreateBookingInput,
): Promise<AppointmentDocument> {
  const service = await getServiceForBooking(input.serviceId);
  const startAt = parseStartAt(input.startAt);

  // Authoritative re-check: the slot list the client saw may be stale.
  await assertSlotIsBookable({
    startAt,
    durationMinutes: service.durationMinutes,
    availableWeekdays: service.availableWeekdays.length ? service.availableWeekdays : undefined,
  });

  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
  const appointment = new Appointment({
    client: clientId,
    service: service._id,
    serviceNameSnapshot: service.name,
    durationMinutes: service.durationMinutes,
    requestedStartAt: startAt,
    startAt,
    endAt,
    status: AppointmentStatus.PENDING,
    ...(input.clientNotes ? { clientNotes: input.clientNotes } : {}),
  });

  pushHistory(appointment, AppointmentStatus.PENDING, {
    id: clientId,
    role: UserRole.CLIENT,
  }, 'Booking request submitted.');

  // Claim the slot before persisting: if another client wins the race we fail
  // here and no orphan appointment is ever written.
  await acquireSlot(appointment._id, startAt, service.durationMinutes);
  try {
    await appointment.save();
  } catch (error) {
    await releaseSlot(appointment._id);
    throw error;
  }

  const client = await User.findById(clientId).select('fullName').lean();

  await Promise.all([
    createNotification({
      recipient: clientId,
      type: NotificationType.BOOKING_SUBMITTED,
      title: 'Booking request submitted',
      body: `We have received your request for ${describe(appointment)}. The lounge will confirm it shortly.`,
      appointment: appointment._id,
    }),
    notifyAdmins({
      type: NotificationType.NEW_BOOKING_REQUEST,
      title: 'New booking request',
      body: `${client?.fullName ?? 'A client'} requested ${describe(appointment)}.`,
      appointment: appointment._id,
    }),
  ]);

  return appointment;
}

export interface CreateBookingForClientInput extends CreateBookingInput {
  clientId: string;
  adminNotes?: string;
}

/**
 * Books a client in from the front desk.
 *
 * Unlike a client's own request this lands CONFIRMED — the lounge is the party
 * that would otherwise approve it, so making it wait for its own approval would
 * be theatre — and the minimum-notice window is waived, because a walk-in is
 * standing at the desk now. Everything else (opening hours, breaks, blocked
 * periods, double booking) is still checked exactly as it is for a client.
 */
export async function createBookingForClient(
  actor: Actor,
  input: CreateBookingForClientInput,
): Promise<AppointmentDocument> {
  const client = await User.findOne({ _id: input.clientId, role: UserRole.CLIENT })
    .select('fullName isActive')
    .lean();
  if (!client) throw ApiError.notFound('That client could not be found.');
  if (!client.isActive) {
    throw ApiError.conflict('That client account is deactivated. Reactivate it before booking.');
  }

  const service = await getServiceForBooking(input.serviceId);
  const startAt = parseStartAt(input.startAt);

  await assertSlotIsBookable({
    startAt,
    durationMinutes: service.durationMinutes,
    availableWeekdays: service.availableWeekdays.length ? service.availableWeekdays : undefined,
    ignoreNotice: true,
  });

  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
  const appointment = new Appointment({
    client: client._id,
    service: service._id,
    serviceNameSnapshot: service.name,
    durationMinutes: service.durationMinutes,
    requestedStartAt: startAt,
    startAt,
    endAt,
    status: AppointmentStatus.CONFIRMED,
    ...(input.clientNotes ? { clientNotes: input.clientNotes } : {}),
    ...(input.adminNotes ? { adminNotes: input.adminNotes } : {}),
  });

  pushHistory(appointment, AppointmentStatus.CONFIRMED, actor, 'Booked by the lounge.');

  // Same ordering as a client booking: claim the slot first so a lost race
  // never leaves an orphan appointment behind.
  await acquireSlot(appointment._id, startAt, service.durationMinutes);
  try {
    await appointment.save();
  } catch (error) {
    await releaseSlot(appointment._id);
    throw error;
  }

  await createNotification({
    recipient: client._id,
    type: NotificationType.BOOKING_APPROVED,
    title: 'Appointment booked',
    body: `Nurella booked an appointment for you: ${describe(appointment)}.`,
    appointment: appointment._id,
  });

  return appointment;
}

// ---------------------------------------------------------------------------
// Admin decisions
// ---------------------------------------------------------------------------

export async function approveAppointment(
  appointmentId: string,
  actor: Actor,
  adminNotes?: string,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.CONFIRMED, actor);

  appointment.status = AppointmentStatus.CONFIRMED;
  if (adminNotes) appointment.adminNotes = adminNotes;
  appointment.offer = undefined;
  appointment.rescheduleRequest = undefined;
  pushHistory(appointment, AppointmentStatus.CONFIRMED, actor, adminNotes);
  await appointment.save();

  await createNotification({
    recipient: appointment.client,
    type: NotificationType.BOOKING_APPROVED,
    title: 'Appointment confirmed',
    body: `Your appointment is confirmed: ${describe(appointment)}.`,
    appointment: appointment._id,
  });

  return appointment;
}

export async function rejectAppointment(
  appointmentId: string,
  actor: Actor,
  reason?: string,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.REJECTED, actor);

  appointment.status = AppointmentStatus.REJECTED;
  if (reason) appointment.cancellationReason = reason;
  appointment.offer = undefined;
  appointment.rescheduleRequest = undefined;
  pushHistory(appointment, AppointmentStatus.REJECTED, actor, reason);
  await appointment.save();
  // The time goes back on the calendar immediately.
  await releaseSlot(appointment._id);

  await createNotification({
    recipient: appointment.client,
    type: NotificationType.BOOKING_REJECTED,
    title: 'Booking request declined',
    body: reason
      ? `Your request for ${describe(appointment)} could not be accepted: ${reason}`
      : `Unfortunately your request for ${describe(appointment)} could not be accepted. Please choose another time or contact the lounge.`,
    appointment: appointment._id,
  });

  return appointment;
}

export interface OfferTimeInput {
  startAt: string;
  message?: string;
}

/**
 * Proposes a different time. The proposed slot is claimed straight away so it
 * cannot be taken while the client decides.
 */
export async function offerTime(
  appointmentId: string,
  actor: Actor,
  input: OfferTimeInput,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.TIME_OFFERED, actor);

  const startAt = parseStartAt(input.startAt);
  await assertSlotIsBookable({
    startAt,
    durationMinutes: appointment.durationMinutes,
    availableWeekdays: await serviceWeekdaysFor(appointment.service),
    excludeAppointmentId: appointment._id,
    ignoreNotice: true,
  });

  await moveSlot(appointment._id, startAt, appointment.durationMinutes);

  const expiresAt = new Date(Date.now() + env.TIME_OFFER_EXPIRY_HOURS * 60 * 60 * 1000);
  appointment.startAt = startAt;
  appointment.endAt = new Date(startAt.getTime() + appointment.durationMinutes * 60_000);
  appointment.status = AppointmentStatus.TIME_OFFERED;
  appointment.rescheduleRequest = undefined;
  appointment.offer = {
    startAt,
    ...(input.message ? { message: input.message } : {}),
    offeredBy: actor.id,
    offeredAt: new Date(),
    expiresAt,
  };
  pushHistory(appointment, AppointmentStatus.TIME_OFFERED, actor, input.message);
  await appointment.save();

  await createNotification({
    recipient: appointment.client,
    type: NotificationType.TIME_OFFERED,
    title: 'A new time has been offered',
    body: `Nurella proposed a new time for your appointment: ${describe(appointment, startAt)}. Please accept or decline.`,
    appointment: appointment._id,
  });

  return appointment;
}

/** Moves a confirmed appointment directly, keeping it confirmed. */
export async function rescheduleByAdmin(
  appointmentId: string,
  actor: Actor,
  input: { startAt: string; message?: string },
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  if (appointment.status !== AppointmentStatus.CONFIRMED) {
    throw new ApiError(
      409,
      ErrorCode.INVALID_TRANSITION,
      'Only a confirmed appointment can be moved directly. Offer a new time instead.',
    );
  }

  const startAt = parseStartAt(input.startAt);
  await assertSlotIsBookable({
    startAt,
    durationMinutes: appointment.durationMinutes,
    availableWeekdays: await serviceWeekdaysFor(appointment.service),
    excludeAppointmentId: appointment._id,
    ignoreNotice: true,
  });
  await moveSlot(appointment._id, startAt, appointment.durationMinutes);

  appointment.startAt = startAt;
  appointment.endAt = new Date(startAt.getTime() + appointment.durationMinutes * 60_000);
  pushHistory(appointment, AppointmentStatus.CONFIRMED, actor, input.message ?? 'Rescheduled.');
  await appointment.save();

  await createNotification({
    recipient: appointment.client,
    type: NotificationType.APPOINTMENT_RESCHEDULED,
    title: 'Appointment rescheduled',
    body: `Your appointment has been moved to ${describe(appointment, startAt)}.${
      input.message ? ` ${input.message}` : ''
    }`,
    appointment: appointment._id,
  });

  return appointment;
}

export async function completeAppointment(
  appointmentId: string,
  actor: Actor,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.COMPLETED, actor);

  appointment.status = AppointmentStatus.COMPLETED;
  pushHistory(appointment, AppointmentStatus.COMPLETED, actor);
  await appointment.save();
  // Locks stay: the time really was used and must not reopen.

  await createNotification({
    recipient: appointment.client,
    type: NotificationType.APPOINTMENT_COMPLETED,
    title: 'Thank you for visiting Nurella',
    body: `Your appointment ${describe(appointment)} is complete.`,
    appointment: appointment._id,
  });

  return appointment;
}

export async function markNoShow(
  appointmentId: string,
  actor: Actor,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.NO_SHOW, actor);

  appointment.status = AppointmentStatus.NO_SHOW;
  pushHistory(appointment, AppointmentStatus.NO_SHOW, actor);
  await appointment.save();
  return appointment;
}

// ---------------------------------------------------------------------------
// Client actions
// ---------------------------------------------------------------------------

export async function acceptOfferedTime(
  appointmentId: string,
  actor: Actor,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.CONFIRMED, actor);

  if (!appointment.offer) {
    throw ApiError.conflict('There is no time offer on this appointment.');
  }
  if (appointment.offer.expiresAt.getTime() < Date.now()) {
    throw new ApiError(
      409,
      ErrorCode.OFFER_EXPIRED,
      'This time offer has expired. Please contact the lounge or submit a new request.',
    );
  }

  appointment.status = AppointmentStatus.CONFIRMED;
  appointment.offer = undefined;
  pushHistory(appointment, AppointmentStatus.CONFIRMED, actor, 'Client accepted the offered time.');
  await appointment.save();

  const client = await User.findById(appointment.client).select('fullName').lean();
  await Promise.all([
    createNotification({
      recipient: appointment.client,
      type: NotificationType.TIME_OFFER_ACCEPTED,
      title: 'Appointment confirmed',
      body: `Your appointment is confirmed: ${describe(appointment)}.`,
      appointment: appointment._id,
    }),
    notifyAdmins({
      type: NotificationType.TIME_OFFER_ACCEPTED,
      title: 'Offered time accepted',
      body: `${client?.fullName ?? 'A client'} accepted ${describe(appointment)}.`,
      appointment: appointment._id,
    }),
  ]);

  return appointment;
}

export async function declineOfferedTime(
  appointmentId: string,
  actor: Actor,
  reason?: string,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.CANCELLED, actor);

  appointment.status = AppointmentStatus.CANCELLED;
  appointment.cancellationReason = reason ?? 'Client declined the offered time.';
  appointment.offer = undefined;
  pushHistory(appointment, AppointmentStatus.CANCELLED, actor, appointment.cancellationReason);
  await appointment.save();
  await releaseSlot(appointment._id);

  const client = await User.findById(appointment.client).select('fullName').lean();
  await notifyAdmins({
    type: NotificationType.TIME_OFFER_DECLINED,
    title: 'Offered time declined',
    body: `${client?.fullName ?? 'A client'} declined the time offered for ${describe(appointment)}.`,
    appointment: appointment._id,
  });

  return appointment;
}

/**
 * The client asks for a different time. Their existing slot is deliberately
 * *kept* until the lounge acts, so a declined request does not cost them the
 * appointment they already had.
 */
export async function requestReschedule(
  appointmentId: string,
  actor: Actor,
  input: { proposedStartAt: string; message?: string },
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.RESCHEDULE_REQUESTED, actor);

  const proposedStartAt = parseStartAt(input.proposedStartAt, 'proposedStartAt');
  await assertSlotIsBookable({
    startAt: proposedStartAt,
    durationMinutes: appointment.durationMinutes,
    availableWeekdays: await serviceWeekdaysFor(appointment.service),
    excludeAppointmentId: appointment._id,
  });

  appointment.status = AppointmentStatus.RESCHEDULE_REQUESTED;
  appointment.offer = undefined;
  appointment.rescheduleRequest = {
    proposedStartAt,
    ...(input.message ? { message: input.message } : {}),
    requestedAt: new Date(),
  };
  pushHistory(appointment, AppointmentStatus.RESCHEDULE_REQUESTED, actor, input.message);
  await appointment.save();

  const client = await User.findById(appointment.client).select('fullName').lean();
  await notifyAdmins({
    type: NotificationType.RESCHEDULE_REQUESTED,
    title: 'Reschedule requested',
    body: `${client?.fullName ?? 'A client'} asked to move ${describe(appointment)} to ${formatInLoungeZone(
      proposedStartAt,
      "EEE, d MMM yyyy 'at' HH:mm",
    )}.`,
    appointment: appointment._id,
  });

  return appointment;
}

/** Admin accepts the client's proposed time and confirms it. */
export async function approveReschedule(
  appointmentId: string,
  actor: Actor,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.CONFIRMED, actor);

  const proposed = appointment.rescheduleRequest?.proposedStartAt;
  if (!proposed) {
    throw ApiError.conflict('There is no reschedule request on this appointment.');
  }

  await assertSlotIsBookable({
    startAt: proposed,
    durationMinutes: appointment.durationMinutes,
    availableWeekdays: await serviceWeekdaysFor(appointment.service),
    excludeAppointmentId: appointment._id,
    ignoreNotice: true,
  });
  await moveSlot(appointment._id, proposed, appointment.durationMinutes);

  appointment.startAt = proposed;
  appointment.endAt = new Date(proposed.getTime() + appointment.durationMinutes * 60_000);
  appointment.status = AppointmentStatus.CONFIRMED;
  appointment.rescheduleRequest = undefined;
  pushHistory(appointment, AppointmentStatus.CONFIRMED, actor, 'Reschedule approved.');
  await appointment.save();

  await createNotification({
    recipient: appointment.client,
    type: NotificationType.APPOINTMENT_RESCHEDULED,
    title: 'Appointment rescheduled',
    body: `Your appointment has been moved to ${describe(appointment)}.`,
    appointment: appointment._id,
  });

  return appointment;
}

export async function cancelAppointment(
  appointmentId: string,
  actor: Actor,
  reason?: string,
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);
  assertTransition(appointment, AppointmentStatus.CANCELLED, actor);

  appointment.status = AppointmentStatus.CANCELLED;
  appointment.cancellationReason = reason ?? undefined;
  appointment.offer = undefined;
  appointment.rescheduleRequest = undefined;
  pushHistory(appointment, AppointmentStatus.CANCELLED, actor, reason);
  await appointment.save();
  await releaseSlot(appointment._id);

  if (isLoungeSide(actor.role)) {
    await createNotification({
      recipient: appointment.client,
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: 'Appointment cancelled',
      body: `Your appointment ${describe(appointment)} has been cancelled.${reason ? ` ${reason}` : ''}`,
      appointment: appointment._id,
    });
  } else {
    const client = await User.findById(appointment.client).select('fullName').lean();
    await notifyAdmins({
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: 'Appointment cancelled by client',
      body: `${client?.fullName ?? 'A client'} cancelled ${describe(appointment)}.`,
      appointment: appointment._id,
    });
  }

  return appointment;
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Cancels time offers the client never answered, freeing the held slot.
 * Run periodically; also safe to call on demand.
 */
/**
 * Edits an appointment in place: its treatment, its time, its notes.
 *
 * Distinct from `rescheduleByAdmin`, which only moves a confirmed appointment
 * and tells the client it moved. This is the correction path — a booking taken
 * down wrong at the desk — so it also accepts a different service, and works on
 * any appointment that has not reached a terminal state.
 *
 * Changing the service changes the duration, which changes how many slot cells
 * are held; the lock is re-acquired for the new span rather than patched.
 */
export async function editAppointment(
  appointmentId: string,
  actor: Actor,
  input: { serviceId?: string; startAt?: string; clientNotes?: string; adminNotes?: string },
): Promise<AppointmentDocument> {
  const appointment = await loadAppointment(appointmentId, actor);

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    throw new ApiError(
      409,
      ErrorCode.INVALID_TRANSITION,
      'This appointment is closed and can no longer be edited.',
    );
  }

  const service = input.serviceId ? await getServiceForBooking(input.serviceId) : null;
  const durationMinutes = service?.durationMinutes ?? appointment.durationMinutes;
  const startAt = input.startAt ? parseStartAt(input.startAt) : appointment.startAt;

  const timingChanged =
    startAt.getTime() !== appointment.startAt.getTime() ||
    durationMinutes !== appointment.durationMinutes;

  if (timingChanged) {
    await assertSlotIsBookable({
      startAt,
      durationMinutes,
      availableWeekdays: service
        ? service.availableWeekdays.length
          ? service.availableWeekdays
          : undefined
        : await serviceWeekdaysFor(appointment.service),
      excludeAppointmentId: appointment._id,
      // The lounge is correcting its own record; the notice window is a rule
      // for clients booking themselves in, not for the desk fixing a mistake.
      ignoreNotice: true,
    });
    await moveSlot(appointment._id, startAt, durationMinutes);
  }

  if (service) {
    appointment.service = service._id;
    appointment.serviceNameSnapshot = service.name;
    appointment.durationMinutes = service.durationMinutes;
  }
  appointment.startAt = startAt;
  appointment.endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
  if (input.clientNotes !== undefined) appointment.clientNotes = input.clientNotes || undefined;
  if (input.adminNotes !== undefined) appointment.adminNotes = input.adminNotes || undefined;

  pushHistory(appointment, appointment.status, actor, 'Appointment details edited.');
  await appointment.save();

  // Only tell the client when something they would turn up for has changed.
  // A corrected internal note is not news.
  if (timingChanged || service) {
    await createNotification({
      recipient: appointment.client,
      type: NotificationType.APPOINTMENT_RESCHEDULED,
      title: 'Appointment updated',
      body: `Your appointment has been updated: ${describe(appointment)}.`,
      appointment: appointment._id,
    });
  }

  return appointment;
}

/**
 * Removes an appointment permanently.
 *
 * Cancelling is almost always the right action — it keeps the record of what
 * was booked and why it did not happen. This is for entries that should never
 * have existed: a duplicate, a test, a booking taken against the wrong client.
 *
 * The slot lock is released first. An appointment row deleted while its cells
 * are still held would block that time for good, with nothing left to point at
 * the cause.
 */
export async function deleteAppointment(appointmentId: string, actor: Actor): Promise<void> {
  const appointment = await loadAppointment(appointmentId, actor);
  await releaseSlot(appointment._id);
  await appointment.deleteOne();

  logger.info('Appointment deleted', {
    appointmentId: appointment._id.toString(),
    by: actor.id.toString(),
  });
}

export async function expireStaleOffers(): Promise<number> {
  const stale = await Appointment.find({
    status: AppointmentStatus.TIME_OFFERED,
    'offer.expiresAt': { $lt: new Date() },
  });

  for (const appointment of stale) {
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancellationReason = 'The offered time expired without a response.';
    appointment.offer = undefined;
    pushHistory(appointment, AppointmentStatus.CANCELLED, 'SYSTEM', 'Time offer expired.');
    await appointment.save();
    await releaseSlot(appointment._id);

    await createNotification({
      recipient: appointment.client,
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: 'Time offer expired',
      body: `The time offered for ${describe(appointment)} expired. Please book again or contact the lounge.`,
      appointment: appointment._id,
    });
  }

  return stale.length;
}
