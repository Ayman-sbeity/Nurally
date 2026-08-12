import type { Request, Response } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { Appointment, type AppointmentAttrs } from '../models/Appointment';
import { User } from '../models/User';
import * as appointmentService from '../services/appointment.service';
import { AppointmentStatus, UserRole, allowedTransitions } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, paginate } from '../utils/respond';
import type { ListAppointmentsQuery } from '../validators/appointment.validators';

/** Fields safe to expose about the client on an appointment. */
const CLIENT_FIELDS = 'fullName email phone';
const SERVICE_FIELDS = 'name slug category durationMinutes imageUrl';

function actorFrom(req: Request): appointmentService.Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user._id, role: req.user.role };
}

async function buildFilter(
  query: ListAppointmentsQuery,
  restrictToClient?: Types.ObjectId,
): Promise<FilterQuery<AppointmentAttrs>> {
  const filter: FilterQuery<AppointmentAttrs> = {};
  if (restrictToClient) filter.client = restrictToClient;
  else if (query.clientId) filter.client = new Types.ObjectId(query.clientId);

  if (query.serviceId) filter.service = new Types.ObjectId(query.serviceId);
  if (query.status?.length) filter.status = { $in: query.status as AppointmentStatus[] };

  const range: Record<string, Date> = {};
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) range.$lte = new Date(query.to);

  if (query.scope === 'upcoming') range.$gte = range.$gte ?? new Date();
  if (query.scope === 'past') range.$lt = new Date();

  if (Object.keys(range).length > 0) filter.startAt = range;

  if (query.search) {
    // Match the service snapshot directly, plus any client whose name / email /
    // phone matches — a small extra query that keeps admin search intuitive.
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = { $regex: escaped, $options: 'i' };
    const matchingClients = await User.find({
      $or: [{ fullName: regex }, { email: regex }, { phone: regex }],
    })
      .select('_id')
      .limit(200)
      .lean();

    filter.$or = [
      { serviceNameSnapshot: regex },
      ...(matchingClients.length
        ? [{ client: { $in: matchingClients.map((client) => client._id) } }]
        : []),
    ];
  }

  return filter;
}

async function listAppointments(
  req: Request,
  res: Response,
  restrictToClient?: Types.ObjectId,
): Promise<void> {
  const query = req.query as unknown as ListAppointmentsQuery;
  const filter = await buildFilter(query, restrictToClient);
  const sortDirection = query.scope === 'past' ? -1 : 1;

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ startAt: sortDirection })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('client', CLIENT_FIELDS)
      .populate('service', SERVICE_FIELDS)
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  ok(res, paginate(items, total, query.page, query.limit));
}

// --- Client ----------------------------------------------------------------

export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const appointment = await appointmentService.createBooking(req.user._id, req.body);
  await appointment.populate([
    { path: 'service', select: SERVICE_FIELDS },
    { path: 'client', select: CLIENT_FIELDS },
  ]);
  ok(res, { appointment: appointment.toJSON() }, 201);
});

export const listMyAppointments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await listAppointments(req, res, req.user._id);
});

export const getAppointment = asyncHandler(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const appointment = await appointmentService.loadAppointment(req.params.id as string, actor);
  await appointment.populate([
    { path: 'service', select: SERVICE_FIELDS },
    { path: 'client', select: actor.role === UserRole.ADMIN ? CLIENT_FIELDS : 'fullName' },
  ]);

  ok(res, {
    appointment: appointment.toJSON(),
    // Drives which action buttons the UI renders — the server stays authoritative.
    availableActions: allowedTransitions(appointment.status, actor.role),
  });
});

export const acceptOffer = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.acceptOfferedTime(
    req.params.id as string,
    actorFrom(req),
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const declineOffer = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.declineOfferedTime(
    req.params.id as string,
    actorFrom(req),
    req.body?.reason,
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const requestReschedule = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.requestReschedule(
    req.params.id as string,
    actorFrom(req),
    req.body,
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const cancelAppointment = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.cancelAppointment(
    req.params.id as string,
    actorFrom(req),
    req.body?.reason,
  );
  ok(res, { appointment: appointment.toJSON() });
});

// --- Admin -----------------------------------------------------------------

export const listAllAppointments = asyncHandler(async (req: Request, res: Response) => {
  await listAppointments(req, res);
});

/** Front-desk booking: the lounge books an existing client in directly. */
export const createForClient = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.createBookingForClient(actorFrom(req), req.body);
  await appointment.populate([
    { path: 'service', select: SERVICE_FIELDS },
    { path: 'client', select: CLIENT_FIELDS },
  ]);
  ok(res, { appointment: appointment.toJSON() }, 201);
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.approveAppointment(
    req.params.id as string,
    actorFrom(req),
    req.body?.adminNotes,
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.rejectAppointment(
    req.params.id as string,
    actorFrom(req),
    req.body?.reason,
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const offerTime = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.offerTime(
    req.params.id as string,
    actorFrom(req),
    req.body,
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const reschedule = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.rescheduleByAdmin(
    req.params.id as string,
    actorFrom(req),
    req.body,
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const approveReschedule = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.approveReschedule(
    req.params.id as string,
    actorFrom(req),
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const complete = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.completeAppointment(
    req.params.id as string,
    actorFrom(req),
  );
  ok(res, { appointment: appointment.toJSON() });
});

export const noShow = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await appointmentService.markNoShow(req.params.id as string, actorFrom(req));
  ok(res, { appointment: appointment.toJSON() });
});
