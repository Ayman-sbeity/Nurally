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
import { randomBytes } from 'node:crypto';
import { addDays } from 'date-fns';
import mongoose, { type Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { Appointment } from '../models/Appointment';
import { BlockedPeriod } from '../models/BlockedPeriod';
import { ClientAsset } from '../models/ClientAsset';
import { ClientPhotoSet } from '../models/ClientPhotoSet';
import { GalleryImage } from '../models/GalleryImage';
import { Notification } from '../models/Notification';
import { Service, type ServiceDocument } from '../models/Service';
import { SlotLock } from '../models/SlotLock';
import { User, type UserDocument } from '../models/User';
import { WorkingHours } from '../models/WorkingHours';
import { computeDayAvailability } from '../services/availability.service';
import { acquireSlot } from '../services/slotLock.service';
import { storage } from '../services/storage';
import { AppointmentStatus, AssetKind, PhotoPhase, UserRole } from '../types/domain';
import { DEMO_CLIENTS, DEMO_CLIENT_PASSWORD, type DemoClientSpec } from './demoClients';
import { placeholderPdf, placeholderPhoto } from './demoMedia';
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

// --- Demo clients, photographs and files ------------------------------------

/**
 * Creates the demo roster. Clients marked `hasLogin: false` get a hash of
 * random bytes nobody holds — the same shape a front-desk record has, so the
 * seed exercises that path rather than quietly giving everyone a password.
 */
async function seedDemoClients(): Promise<Map<string, UserDocument>> {
  const clients = new Map<string, UserDocument>();

  for (const spec of DEMO_CLIENTS) {
    let client = await User.findOne({ email: spec.email });
    if (!client) {
      client = await User.create({
        fullName: spec.fullName,
        email: spec.email,
        phone: spec.phone,
        passwordHash: await User.hashPassword(
          spec.hasLogin ? DEMO_CLIENT_PASSWORD : randomBytes(48).toString('hex'),
        ),
        role: UserRole.CLIENT,
        isActive: true,
        clientProfile: { notes: `${spec.notes} ${DEMO_TAG}`, preferredServices: [], marketingOptIn: false },
      });
    }
    clients.set(spec.email, client);
  }

  const withLogin = DEMO_CLIENTS.filter((c) => c.hasLogin).length;
  logger.info(
    `Demo clients ensured: ${clients.size} (${withLogin} with a login, ${clients.size - withLogin} record-only) ${DEMO_TAG}`,
  );
  return clients;
}

/** Writes one placeholder image through the storage adapter and records it. */
async function attachPhoto(input: {
  client: UserDocument;
  setId: Types.ObjectId;
  phase: PhotoPhase;
  adminId: Types.ObjectId;
}): Promise<void> {
  const bytes = placeholderPhoto(input.phase === PhotoPhase.BEFORE ? 'before' : 'after');
  const stored = await storage.save(bytes, { extension: '.png' });

  await ClientAsset.create({
    client: input.client._id,
    kind: AssetKind.PHOTO,
    photoSet: input.setId,
    phase: input.phase,
    storageKey: stored.key,
    originalName: `${input.phase.toLowerCase()}-placeholder.png`,
    mimeType: 'image/png',
    sizeBytes: stored.sizeBytes,
    caption: 'Placeholder — not a real client photograph.',
    uploadedBy: input.adminId,
  });
}

async function seedDemoMedia(
  clients: Map<string, UserDocument>,
  services: ServiceDocument[],
  adminId: Types.ObjectId,
): Promise<void> {
  if (env.isProduction) {
    logger.error('Refusing to seed demo media in production.');
    return;
  }

  const byName = new Map(services.map((service) => [service.name.toLowerCase(), service]));
  let sets = 0;
  let photos = 0;
  let documents = 0;

  for (const spec of DEMO_CLIENTS) {
    const client = clients.get(spec.email);
    if (!client) continue;

    // Idempotent: never stack a second copy of the fixtures on a re-run.
    const already = await ClientPhotoSet.countDocuments({ client: client._id });

    for (const setSpec of already > 0 ? [] : (spec.photoSets ?? [])) {
      const service = setSpec.serviceName ? byName.get(setSpec.serviceName.toLowerCase()) : undefined;
      const takenAt = addDays(new Date(), -setSpec.daysAgo);

      const set = await ClientPhotoSet.create({
        client: client._id,
        title: setSpec.title,
        ...(service ? { service: service._id } : {}),
        takenAt,
        notes: `${setSpec.notes} ${DEMO_TAG}`,
        consentToPublish: setSpec.consentToPublish,
        ...(setSpec.consentToPublish ? { consentRecordedAt: takenAt } : {}),
        createdBy: adminId,
      });
      sets += 1;

      await attachPhoto({ client, setId: set._id, phase: PhotoPhase.BEFORE, adminId });
      photos += 1;
      if (setSpec.afterPhoto) {
        await attachPhoto({ client, setId: set._id, phase: PhotoPhase.AFTER, adminId });
        photos += 1;
      }
    }

    const existingDocs = await ClientAsset.countDocuments({
      client: client._id,
      kind: AssetKind.DOCUMENT,
    });
    for (const title of existingDocs > 0 ? [] : (spec.documents ?? [])) {
      const bytes = placeholderPdf(title);
      const stored = await storage.save(bytes, { extension: '.pdf' });
      await ClientAsset.create({
        client: client._id,
        kind: AssetKind.DOCUMENT,
        storageKey: stored.key,
        originalName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: stored.sizeBytes,
        caption: DEMO_TAG,
        uploadedBy: adminId,
      });
      documents += 1;
    }
  }

  if (sets + documents === 0) {
    logger.info('Demo client media already present — skipping.');
    return;
  }
  logger.info(
    `Demo media created: ${sets} before/after record(s), ${photos} photo(s), ${documents} file(s) ${DEMO_TAG}`,
  );
}

/** Spreads a short appointment history across the demo roster. */
async function seedDemoHistory(
  clients: Map<string, UserDocument>,
  services: ServiceDocument[],
): Promise<void> {
  const pick = (index: number): ServiceDocument => {
    const service = services[index % services.length];
    if (!service) throw new Error('No services available to build demo data.');
    return service;
  };

  const plan: { email: string; status: AppointmentStatus; daysAgo?: number }[] = [
    { email: 'layla.demo@nurella.local', status: AppointmentStatus.COMPLETED, daysAgo: 56 },
    { email: 'layla.demo@nurella.local', status: AppointmentStatus.COMPLETED, daysAgo: 14 },
    { email: 'layla.demo@nurella.local', status: AppointmentStatus.CONFIRMED },
    { email: 'nour.demo@nurella.local', status: AppointmentStatus.COMPLETED, daysAgo: 21 },
    { email: 'nour.demo@nurella.local', status: AppointmentStatus.PENDING },
    { email: 'rana.demo@nurella.local', status: AppointmentStatus.PENDING },
    { email: 'maya.demo@nurella.local', status: AppointmentStatus.TIME_OFFERED },
    { email: 'sara.demo@nurella.local', status: AppointmentStatus.COMPLETED, daysAgo: 40 },
    { email: 'sara.demo@nurella.local', status: AppointmentStatus.CANCELLED, daysAgo: 9 },
    { email: 'sara.demo@nurella.local', status: AppointmentStatus.CONFIRMED },
  ];

  /*
   * All-or-nothing, like the demo appointments above. A per-client check would
   * let a partially-populated roster through on a re-run, and the past-dated
   * fixtures would then collide with the slot locks they already hold.
   */
  const roster = [...clients.values()].map((client) => client._id);
  if ((await Appointment.countDocuments({ client: { $in: roster } })) > 0) {
    logger.info('Demo roster appointments already present — skipping.');
    return;
  }

  let created = 0;
  for (const [index, entry] of plan.entries()) {
    const client = clients.get(entry.email);
    if (!client) continue;

    const service = pick(index);
    // Past fixtures sit on a fixed hour; future ones ask the availability engine
    // for a genuinely free slot, so the demo data never collides with itself.
    const startAt =
      entry.daysAgo === undefined
        ? await findNextAvailableSlot(service.durationMinutes)
        : new Date(addDays(new Date(), -entry.daysAgo).setHours(10 + (index % 6), 0, 0, 0));

    if (!startAt) {
      logger.warn('No bookable slot left for demo history — stopping early.');
      break;
    }

    await createDemoAppointment({
      clientId: client._id,
      service,
      startAt,
      status: entry.status,
    });
    created += 1;
  }

  logger.info(`Demo appointments across the roster: ${created} ${DEMO_TAG}`);
}

async function reset(): Promise<void> {
  if (env.isProduction) throw new Error('Refusing to run --reset in production.');

  // Remove the stored objects before the rows that point at them, otherwise the
  // keys are lost and the files are orphaned on disk forever.
  const assets = await ClientAsset.find().select('+storageKey').lean();
  await Promise.all(assets.map((asset) => storage.remove(asset.storageKey)));

  await Promise.all([
    Appointment.deleteMany({}),
    SlotLock.deleteMany({}),
    Service.deleteMany({}),
    GalleryImage.deleteMany({}),
    WorkingHours.deleteMany({}),
    BlockedPeriod.deleteMany({}),
    Notification.deleteMany({}),
    ClientAsset.deleteMany({}),
    ClientPhotoSet.deleteMany({}),
    User.deleteMany({ role: UserRole.CLIENT }),
  ]);
  logger.warn(
    `Reset complete — appointments, catalogue, gallery, clients and ${assets.length} stored file(s) removed.`,
  );
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

  if (withDemo) {
    const admin = await User.findOne({ role: UserRole.ADMIN }).select('_id');
    if (!admin) throw new Error('No admin to attribute demo media to.');

    await seedDemoData(services);
    const clients = await seedDemoClients();
    await seedDemoHistory(clients, services);
    await seedDemoMedia(clients, services, admin._id);
  }

  logger.info('Seed complete.');
  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error('Seed failed', error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
