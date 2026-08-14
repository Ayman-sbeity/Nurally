/**
 * Builds — or refreshes — the BusinessProfile the WhatsApp assistant answers
 * from, using the lounge's own catalogue and opening hours.
 *
 *   npm run whatsapp:profile --workspace backend           # dry run
 *   npm run whatsapp:profile:apply --workspace backend     # writes
 *
 * Re-run it after changing treatments or opening hours. It is idempotent, and
 * deliberately narrow: it owns the fields it can derive — name, timezone,
 * services, hours — and never touches `description`, `location`, `faqs`,
 * `pricingPolicy`, `bookingPolicy` or `extraInstructions` on a profile that
 * already exists. Those are the lounge's own words, edited by hand, and a sync
 * script that overwrote them would make editing them pointless.
 *
 * Pass `--phone-number-id <id>` to target a second business on the platform;
 * without it the profile for WA_PHONE_NUMBER_ID is used.
 */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { BusinessProfile } from '../models/BusinessProfile';
import { Service } from '../models/Service';
import { WorkingHours } from '../models/WorkingHours';
import { loungeTimezone } from '../utils/time';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

function arg(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const clock = (minuteOfDay: number): string =>
  `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;

/**
 * Opening hours as a sentence, not a table.
 *
 * Consecutive days on the same schedule are collapsed into a range, because
 * that is how a person answers "when are you open?" — and because seven
 * separate lines in the prompt encourages the model to recite all seven.
 */
async function describeHours(): Promise<string> {
  const rows = await WorkingHours.find().sort({ weekday: 1 }).lean();
  if (rows.length === 0) return 'Opening hours are confirmed by the lounge.';

  // Monday-first: a week that starts on Sunday reads oddly in a sentence.
  const week = [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const row = rows.find((entry) => entry.weekday === weekday);
    return {
      weekday,
      label: DAY_LABELS[weekday] as string,
      span:
        row && row.isOpen ? `${clock(row.openMinute)}–${clock(row.closeMinute)}` : 'closed',
    };
  });

  const groups: { from: string; to: string; span: string }[] = [];
  for (const day of week) {
    const last = groups[groups.length - 1];
    if (last && last.span === day.span) last.to = day.label;
    else groups.push({ from: day.label, to: day.label, span: day.span });
  }

  return groups
    .map((group) => {
      const days = group.from === group.to ? group.from : `${group.from}–${group.to}`;
      return group.span === 'closed' ? `${days}: closed` : `${days}: ${group.span}`;
    })
    .join(', ');
}

async function main(): Promise<void> {
  const phoneNumberId = arg('phone-number-id') ?? env.WA_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    fail('No phone number id. Set WA_PHONE_NUMBER_ID in .env, or pass --phone-number-id <id>.');
  }

  const connection = await connectDatabase();
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — nothing will be written'}`);
  console.log(
    `Database: ${connection.connection.name} @ ${connection.connection.host ?? 'unknown host'}`,
  );
  console.log(`Profile:  phoneNumberId ${phoneNumberId}\n`);

  const services = await Service.find({ isActive: true })
    .sort({ category: 1, displayOrder: 1, name: 1 })
    .lean();

  if (services.length === 0) {
    console.log('  !! No active services. The assistant would have no menu to answer from.');
    console.log('     Run the catalogue seed first: npm run seed --workspace backend\n');
  }

  const hours = await describeHours();
  const existing = await BusinessProfile.findOne({ phoneNumberId });

  const derived = {
    phoneNumberId,
    ...(env.WA_WABA_ID ? { wabaId: env.WA_WABA_ID } : {}),
    name: 'Nurella Beauty Lounge',
    timezone: loungeTimezone,
    hours,
    services: services.map((service) => ({
      name: service.name,
      // Omitted, never zeroed: the prompt turns an absent price into "confirmed
      // at consultation", while a 0 would be read as free.
      ...(service.price !== undefined ? { price: service.price } : {}),
      ...(service.currency ? { currency: service.currency } : {}),
      durationMinutes: service.durationMinutes,
      category: service.category,
      // Only when restricted. An empty array would read in the prompt as a
      // treatment available on no day at all.
      ...(service.availableWeekdays?.length
        ? { availableWeekdays: service.availableWeekdays }
        : {}),
    })),
  };

  /** Written only when the profile is new — see the header comment. */
  const authored = {
    description:
      'Nurella Beauty Lounge is a destination for advanced aesthetics, skin rejuvenation and beauty. Every treatment begins with a personalised consultation and a plan built around the client’s features, skin needs and desired results. The guiding principle is “Enhance, never change.”',
    location: '',
    pricingPolicy:
      'Nurella does not publish a fixed price list. Because every plan is personalised, the price is confirmed during the consultation, before anything is carried out. Only quote a price that appears on the treatment list above.',
    bookingPolicy:
      'Appointments are requested, not booked instantly. The lounge reviews every request and confirms it separately — by message or by phone. Never tell a customer their appointment is confirmed.',
    faqs: [
      {
        q: 'How much does a treatment cost?',
        a: 'Prices are confirmed during the personalised consultation, before any treatment is carried out, because every plan is built around the individual.',
      },
      {
        q: 'Do I need a consultation first?',
        a: 'Yes — every treatment starts with a consultation, so the plan suits your features and skin.',
      },
      {
        q: 'Is my appointment confirmed straight away?',
        a: 'No. Requests are reviewed by the lounge and confirmed separately, usually the same day.',
      },
    ],
  };

  console.log(`Name:      ${derived.name}`);
  console.log(`Timezone:  ${derived.timezone}`);
  console.log(`Hours:     ${derived.hours}`);
  const priced = derived.services.filter((service) => service.price !== undefined);
  const restricted = derived.services.filter((service) => service.availableWeekdays?.length);

  console.log(`Services:  ${derived.services.length} (${priced.length} with a price)`);
  for (const service of derived.services.slice(0, 8)) {
    console.log(
      `   - ${service.name} (${service.durationMinutes} min, ${
        service.price !== undefined ? `${service.price} ${service.currency ?? ''}`.trim() : 'no price'
      })`,
    );
  }
  if (derived.services.length > 8) console.log(`   … and ${derived.services.length - 8} more`);

  // Printed in full: a treatment restricted to the wrong day, or one that has
  // quietly lost its restriction, is the error most likely to send a customer
  // to a locked door.
  console.log(`\nDay-restricted treatments: ${restricted.length}`);
  for (const service of restricted) {
    const days = (service.availableWeekdays ?? []).map((day) => DAY_LABELS[day]).join(', ');
    console.log(
      `   - ${service.name.padEnd(24)} ${days} only, ${service.durationMinutes} min, ${
        service.price !== undefined ? `$${service.price}` : 'no price'
      }`,
    );
  }

  console.log(
    existing
      ? '\n  ~  updating the existing profile (services, hours, name, timezone only)'
      : '\n  +  creating a new profile, including starter description, policies and FAQs',
  );
  if (existing) {
    console.log(
      `     leaving untouched: description, location, ${existing.faqs.length} FAQ(s), pricing/booking policy`,
    );
  }

  if (APPLY) {
    await BusinessProfile.findOneAndUpdate(
      { phoneNumberId },
      { $set: derived, $setOnInsert: { ...authored, isActive: true } },
      { upsert: true, setDefaultsOnInsert: true, new: true },
    );
    console.log('\n  ✓  profile written');
    if (!existing) {
      console.log(
        '     Edit `location`, `description` and `faqs` in the businessprofiles collection —',
      );
      console.log('     the assistant can only state facts that are written there.');
    }
  }

  console.log(`\n${APPLY ? 'Done.' : 'Dry run complete. Re-run with --apply to write.'}\n`);
  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close();
  process.exit(1);
});
