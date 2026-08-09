import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Appointment } from '../models/Appointment';
import { User } from '../models/User';
import { expireStaleOffers } from '../services/appointment.service';
import { AppointmentStatus, UserRole } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, paginate } from '../utils/respond';
import { dateKeyInZone, zonedDayBounds } from '../utils/time';

const CLIENT_FIELDS = 'fullName email phone';
const SERVICE_FIELDS = 'name slug category durationMinutes';

const ACTIVE_UPCOMING: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.TIME_OFFERED,
  AppointmentStatus.RESCHEDULE_REQUESTED,
];

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  // Clear anything the client never responded to before counting, so the
  // numbers on screen reflect the true state of the calendar.
  await expireStaleOffers();

  const now = new Date();
  const { start: todayStart, end: todayEnd } = zonedDayBounds(dateKeyInZone(now));

  const [
    todaysAppointments,
    upcomingAppointments,
    pendingRequests,
    counts,
    totalClients,
    popularServices,
  ] = await Promise.all([
    Appointment.find({ startAt: { $gte: todayStart, $lt: todayEnd } })
      .sort({ startAt: 1 })
      .populate('client', CLIENT_FIELDS)
      .populate('service', SERVICE_FIELDS)
      .lean(),

    Appointment.find({ startAt: { $gte: now }, status: { $in: ACTIVE_UPCOMING } })
      .sort({ startAt: 1 })
      .limit(8)
      .populate('client', CLIENT_FIELDS)
      .populate('service', SERVICE_FIELDS)
      .lean(),

    Appointment.find({ status: AppointmentStatus.PENDING })
      .sort({ createdAt: 1 })
      .limit(10)
      .populate('client', CLIENT_FIELDS)
      .populate('service', SERVICE_FIELDS)
      .lean(),

    Appointment.aggregate<{ _id: AppointmentStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    User.countDocuments({ role: UserRole.CLIENT }),

    Appointment.aggregate<{ _id: Types.ObjectId; name: string; count: number }>([
      { $match: { status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] } } },
      { $group: { _id: '$service', name: { $first: '$serviceNameSnapshot' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const byStatus = Object.fromEntries(
    Object.values(AppointmentStatus).map((status) => [
      status,
      counts.find((entry) => entry._id === status)?.count ?? 0,
    ]),
  ) as Record<AppointmentStatus, number>;

  const upcomingCount = await Appointment.countDocuments({
    startAt: { $gte: now },
    status: { $in: ACTIVE_UPCOMING },
  });

  ok(res, {
    stats: {
      todayCount: todaysAppointments.length,
      pendingCount: byStatus.PENDING,
      confirmedCount: byStatus.CONFIRMED,
      upcomingCount,
      completedCount: byStatus.COMPLETED,
      cancelledCount: byStatus.CANCELLED,
      rejectedCount: byStatus.REJECTED,
      noShowCount: byStatus.NO_SHOW,
      totalClients,
    },
    byStatus,
    todaysAppointments,
    upcomingAppointments,
    pendingRequests,
    popularServices,
  });
});

/** Appointments in a date range, for the calendar views. */
export const getCalendar = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) {
    throw ApiError.badRequest('A date range is required.', [
      { field: 'from', message: 'from and to are required.' },
    ]);
  }

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw ApiError.badRequest('Please provide a valid date range.');
  }

  const appointments = await Appointment.find({ startAt: { $gte: start, $lt: end } })
    .sort({ startAt: 1 })
    .populate('client', CLIENT_FIELDS)
    .populate('service', SERVICE_FIELDS)
    .limit(1000)
    .lean();

  ok(res, { appointments });
});

// --- Client management -----------------------------------------------------

export const listClients = asyncHandler(async (req: Request, res: Response) => {
  const { search, isActive, page, limit } = req.query as unknown as {
    search?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  };

  const filter: Record<string, unknown> = { role: UserRole.CLIENT };
  if (isActive !== undefined) filter.isActive = isActive;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = { $regex: escaped, $options: 'i' };
    filter.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }

  const [clients, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Appointment counts for the list, in one grouped query rather than N.
  const ids = clients.map((client) => client._id);
  const stats = await Appointment.aggregate<{
    _id: Types.ObjectId;
    total: number;
    upcoming: number;
  }>([
    { $match: { client: { $in: ids } } },
    {
      $group: {
        _id: '$client',
        total: { $sum: 1 },
        upcoming: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$startAt', new Date()] },
                  { $in: ['$status', ACTIVE_UPCOMING] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const statsById = new Map(stats.map((entry) => [entry._id.toString(), entry]));
  const items = clients.map((client) => ({
    ...client,
    appointmentStats: {
      total: statsById.get(client._id.toString())?.total ?? 0,
      upcoming: statsById.get(client._id.toString())?.upcoming ?? 0,
    },
  }));

  ok(res, paginate(items, total, page, limit));
});

export const getClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await User.findOne({ _id: req.params.id, role: UserRole.CLIENT }).lean();
  if (!client) throw ApiError.notFound('That client could not be found.');

  const [appointments, preferred] = await Promise.all([
    Appointment.find({ client: client._id })
      .sort({ startAt: -1 })
      .limit(50)
      .populate('service', SERVICE_FIELDS)
      .lean(),
    Appointment.aggregate<{ _id: Types.ObjectId; name: string; count: number }>([
      { $match: { client: client._id } },
      { $group: { _id: '$service', name: { $first: '$serviceNameSnapshot' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]),
  ]);

  ok(res, { client, appointments, preferredServices: preferred });
});

export const updateClient = asyncHandler(async (req: Request, res: Response) => {
  const update: Record<string, unknown> = {};
  if (req.body.notes !== undefined) update['clientProfile.notes'] = req.body.notes;
  if (req.body.isActive !== undefined) update.isActive = req.body.isActive;

  const client = await User.findOneAndUpdate(
    { _id: req.params.id, role: UserRole.CLIENT },
    { $set: update },
    { new: true },
  );
  if (!client) throw ApiError.notFound('That client could not be found.');
  ok(res, { client: client.toJSON() });
});
