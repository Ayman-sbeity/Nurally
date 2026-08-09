/**
 * Development seed.
 *
 * Populates the real Nurella service catalogue, an example working schedule and
 * placeholder gallery entries, plus the bootstrap admin account.
 *
 *   npm run seed              # catalogue + admin (safe to re-run)
 *   npm run seed -- --demo    # also adds clearly-labelled demo booking data
 *   npm run seed -- --reset   # wipes appointments/services/gallery first
 *
 * Demo records are development fixtures. They do not represent real clients or
 * real bookings and are refused outright when NODE_ENV=production.
 */
import { addDays } from 'date-fns';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { Appointment } from '../models/Appointment';
import { BlockedPeriod } from '../models/BlockedPeriod';
import { GalleryImage } from '../models/GalleryImage';
import { Notification } from '../models/Notification';
import { Service, type ServiceDocument } from '../models/Service';
import { SlotLock } from '../models/SlotLock';
import { User } from '../models/User';
import { WorkingHours } from '../models/WorkingHours';
import { computeDayAvailability } from '../services/availability.service';
import { acquireSlot } from '../services/slotLock.service';
import { AppointmentStatus, UserRole } from '../types/domain';
import { logger } from '../utils/logger';
import { uniqueSlug } from '../utils/slugify';
import { dateKeyInZone } from '../utils/time';
import {
  DEFAULT_DURATION_MINUTES,
  EXAMPLE_WORKING_HOURS,
  PLACEHOLDER_GALLERY,
  SEED_SERVICES,
} from './serviceData';

const args = new Set(process.argv.slice(2));
const withDemo = args.has('--demo');
const withReset = args.has('--reset');

const DEMO_TAG = '[DEMO DATA — development only]';

async function seedAdmin(): Promise<void> {
  const existing = await User.findOne({ email: env.SEED_ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    if (existing.role !== UserRole.ADMIN) {
      existing.role = UserRole.ADMIN;
      await existing.save();
    }
    logger.info(`Admin already present: ${existing.email}`);
    return;
  }

  await User.create({
    fullName: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL.toLowerCase(),
    passwordHash: await User.hashPassword(env.SEED_ADMIN_PASSWORD),
    role: UserRole.ADMIN,
    isActive: true,
  });
  logger.info(`Admin created: ${env.SEED_ADMIN_EMAIL}`);
  if (env.SEED_ADMIN_PASSWORD === 'ChangeMe123!') {
    logger.warn('The admin is using the default seed password — change it immediately.');
  }
}

async function seedServices(): Promise<ServiceDocument[]> {
  const existing = await Service.find().select('slug').lean();
  const taken = new Set(existing.map((service) => service.slug));

  let created = 0;
  for (const [index, entry] of SEED_SERVICES.entries()) {
    const found = await Service.findOne({ name: entry.name, category: entry.category });
    if (found) continue;

    const slug = uniqueSlug(`${entry.name}`, taken);
    taken.add(slug);

    await Service.create({
      name: entry.name,
      slug,
      category: entry.category,
      ...(entry.description ? { description: entry.description } : {}),
      // Placeholder duration — see serviceData.ts. No price is set on purpose.
      durationMinutes: entry.durationMinutes ?? DEFAULT_DURATION_MINUTES,
      isActive: true,
      displayOrder: index,
    });
    created += 1;
  }

  logger.info(`Services: ${created} created, ${SEED_SERVICES.length - created} already present.`);
  return Service.find().sort({ displayOrder: 1 });
}

async function seedWorkingHours(): Promise<void> {
  await WorkingHours.bulkWrite(
    EXAMPLE_WORKING_HOURS.map((day) => ({
      updateOne: { filter: { weekday: day.weekday }, update: { $setOnInsert: day }, upsert: true },
    })),
  );
  logger.info('Working hours seeded (example schedule — configure in Admin → Availability).');
}

async function seedGallery(): Promise<void> {
  for (const image of PLACEHOLDER_GALLERY) {
    await GalleryImage.updateOne(
      { title: image.title },
      { $setOnInsert: { ...image, isActive: true } },
      { upsert: true },
    );
  }
  logger.info(`Gallery: ${PLACEHOLDER_GALLERY.length} placeholder entries ensured.`);
}

/** Creates an appointment directly, bypassing the notice window (fixtures only). */
async function createDemoAppointment(params: {
  clientId: mongoose.Types.ObjectId;
  service: ServiceDocument;
  startAt: Date;
  status: AppointmentStatus;
  clientNotes?: string;
}): Promise<void> {
  const { clientId, service, startAt, status, clientNotes } = params;
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

  const appointment = new Appointment({
    client: clientId,
    service: service._id,
    serviceNameSnapshot: service.name,
    durationMinutes: service.durationMinutes,
    requestedStartAt: startAt,
    startAt,
    endAt,
    status,
    clientNotes: clientNotes ?? DEMO_TAG,
    history: [
      { status: AppointmentStatus.PENDING, at: new Date(), byRole: 'SYSTEM', note: DEMO_TAG },
      ...(status === AppointmentStatus.PENDING
        ? []
        : [{ status, at: new Date(), byRole: 'SYSTEM' as const, note: DEMO_TAG }]),
    ],
    ...(status === AppointmentStatus.TIME_OFFERED
      ? {
          offer: {
            startAt,
            message: DEMO_TAG,
            offeredBy: clientId,
            offeredAt: new Date(),
            expiresAt: addDays(new Date(), 2),
          },
        }
      : {}),
  });

  await acquireSlot(appointment._id, startAt, service.durationMinutes);
  await appointment.save();
}

/**
 * The next genuinely bookable slot. Called again after each fixture is created
 * so it sees the slot locks already taken — the same guarantee a real client
 * gets, which is why the demo data can never collide with itself.
 */
async function findNextAvailableSlot(durationMinutes: number): Promise<Date | null> {
  for (let offset = 1; offset <= 21; offset += 1) {
    const dateKey = dateKeyInZone(addDays(new Date(), offset));
    const availability = await computeDayAvailability({ dateKey, durationMinutes });
    const slot = availability.slots[0];
    if (slot) return new Date(slot.startAt);
  }
  return null;
}

async function seedDemoData(services: ServiceDocument[]): Promise<void> {
  if (env.isProduction) {
    logger.error('Refusing to seed demo data in production.');
    return;
  }

  const email = 'demo.client@nurella.local';
  let client = await User.findOne({ email });
  if (!client) {
    client = await User.create({
      fullName: 'Demo Client (development data)',
      email,
      phone: '+00 000 000 000',
      passwordHash: await User.hashPassword('DemoClient123!'),
      role: UserRole.CLIENT,
      clientProfile: { notes: DEMO_TAG },
    });
    logger.info(`Demo client created: ${email} / DemoClient123!`);
  }

  const existingDemo = await Appointment.countDocuments({ client: client._id });
  if (existingDemo > 0) {
    logger.info('Demo appointments already present — skipping.');
    return;
  }

  const pick = (index: number): ServiceDocument => {
    const service = services[index % services.length];
    if (!service) throw new Error('No services available to build demo data.');
    return service;
  };

  const statuses = [
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.TIME_OFFERED,
  ];

  let created = 0;
  for (const [index, status] of statuses.entries()) {
    const startAt = await findNextAvailableSlot(DEFAULT_DURATION_MINUTES);
    if (!startAt) {
      logger.warn('No bookable slot left for demo data — stopping early.');
      break;
    }
    await createDemoAppointment({ clientId: client._id, service: pick(index), startAt, status });
    created += 1;
  }

  // One completed visit in the past so the history view is not empty.
  const past = new Date(addDays(new Date(), -7).setHours(11, 0, 0, 0));
  await createDemoAppointment({
    clientId: client._id,
    service: pick(3),
    startAt: past,
    status: AppointmentStatus.COMPLETED,
  });

  logger.info(`Demo appointments created: ${created + 1} ${DEMO_TAG}`);
}

async function reset(): Promise<void> {
  if (env.isProduction) throw new Error('Refusing to run --reset in production.');
  await Promise.all([
    Appointment.deleteMany({}),
    SlotLock.deleteMany({}),
    Service.deleteMany({}),
    GalleryImage.deleteMany({}),
    WorkingHours.deleteMany({}),
    BlockedPeriod.deleteMany({}),
    Notification.deleteMany({}),
    User.deleteMany({ role: UserRole.CLIENT }),
  ]);
  logger.warn('Reset complete — appointments, catalogue, gallery and clients removed.');
}

async function main(): Promise<void> {
  await connectDatabase();
  // Indexes (notably the unique SlotLock index) must exist before any booking.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));

  if (withReset) await reset();

  await seedAdmin();
  const services = await seedServices();
  await seedWorkingHours();
  await seedGallery();
  if (withDemo) await seedDemoData(services);

  logger.info('Seed complete.');
  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error('Seed failed', error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
