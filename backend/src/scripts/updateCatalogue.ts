/**
 * Applies the lounge's real durations, prices and weekday restrictions to the
 * treatment catalogue.
 *
 * The seeded catalogue shipped with every treatment at a placeholder 60 minutes
 * and no price. This script writes the figures Nurella supplied, creates the
 * treatments that had no record at all, and retires the two generic entries
 * that have been replaced by priced variants.
 *
 * Safe to run repeatedly: every change is keyed by slug and writing the same
 * values twice is a no-op.
 *
 *   npm run catalogue --workspace backend            # dry run, prints a diff
 *   npm run catalogue:apply --workspace backend      # writes
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { Service } from '../models/Service';
import { ServiceCategorySlug } from '../types/domain';

const APPLY = process.argv.includes('--apply');

/** Wednesday, the one day the visiting practitioner works. */
const WED = [3];

const CURRENCY = 'USD';

const WEDNESDAY_NOTE = 'Available Wednesdays only.';

interface Update {
  slug: string;
  durationMinutes: number;
  price?: number;
  availableWeekdays?: number[];
  /** Appended to the existing description rather than replacing it. */
  note?: string;
}

/**
 * Durations are the upper bound of the range Nurella gave. Booking the longer
 * figure can only ever leave a gap; booking the shorter one would overlap the
 * next client.
 */
const UPDATES: Update[] = [
  { slug: 'laser-hair-removal', durationMinutes: 25, price: 50 },
  { slug: 'co2-laser', durationMinutes: 25, price: 100 },
  { slug: 'hifu', durationMinutes: 30, price: 100 },
  { slug: 'rf-microneedling-laser', durationMinutes: 25, price: 80 },
  { slug: 'skin-boosters', durationMinutes: 25, price: 150 },
  {
    slug: 'nano-balading',
    durationMinutes: 90,
    price: 150,
    availableWeekdays: WED,
    note: WEDNESDAY_NOTE,
  },
  {
    slug: 'microbalding',
    durationMinutes: 90,
    price: 150,
    availableWeekdays: WED,
    note: WEDNESDAY_NOTE,
  },
];

interface Creation {
  name: string;
  slug: string;
  category: ServiceCategorySlug;
  description: string;
  durationMinutes: number;
  price: number;
  availableWeekdays?: number[];
  displayOrder: number;
}

const CREATIONS: Creation[] = [
  {
    name: 'Filler — Korean',
    slug: 'filler-korean',
    category: ServiceCategorySlug.FACIAL_AESTHETICS,
    description:
      'Hyaluronic acid filler using a Korean product, placed to restore volume and definition. The plan and the amount are agreed at the consultation.',
    durationMinutes: 20,
    price: 80,
    displayOrder: 20,
  },
  {
    name: 'Filler — France',
    slug: 'filler-france',
    category: ServiceCategorySlug.FACIAL_AESTHETICS,
    description:
      'Hyaluronic acid filler using a French product, placed to restore volume and definition. The plan and the amount are agreed at the consultation.',
    durationMinutes: 20,
    price: 170,
    displayOrder: 21,
  },
  {
    name: 'Botox — Korean',
    slug: 'botox-korean',
    category: ServiceCategorySlug.FACIAL_AESTHETICS,
    description:
      'Muscle-relaxing injections using a Korean product, to soften expression lines. Dosage is decided at the consultation.',
    durationMinutes: 15,
    price: 70,
    displayOrder: 22,
  },
  {
    name: 'Botox — Dysport (UK)',
    slug: 'botox-dysport-uk',
    category: ServiceCategorySlug.FACIAL_AESTHETICS,
    description:
      'Muscle-relaxing injections using Dysport, to soften expression lines. Dosage is decided at the consultation.',
    durationMinutes: 15,
    price: 150,
    displayOrder: 23,
  },
  {
    name: 'Brow retouching',
    slug: 'brow-retouching',
    category: ServiceCategorySlug.PERMANENT_MAKEUP,
    description: `Top-up work on existing microblading or nano blading, refreshing colour and shape. ${WEDNESDAY_NOTE}`,
    durationMinutes: 60,
    price: 50,
    availableWeekdays: WED,
    displayOrder: 20,
  },
  {
    name: 'Laser tattoo removal',
    slug: 'laser-tattoo-removal',
    category: ServiceCategorySlug.LASER,
    description: `Laser breakdown of tattoo pigment across a course of sessions, priced per session. ${WEDNESDAY_NOTE}`,
    durationMinutes: 30,
    price: 40,
    availableWeekdays: WED,
    displayOrder: 20,
  },
  {
    name: 'Belly piercing',
    slug: 'belly-piercing',
    category: ServiceCategorySlug.PIERCING,
    description: `Navel piercing with a sterile single-use needle and fitted jewellery. ${WEDNESDAY_NOTE}`,
    durationMinutes: 10,
    price: 25,
    availableWeekdays: WED,
    displayOrder: 1,
  },
  {
    name: 'Surface piercing',
    slug: 'surface-piercing',
    category: ServiceCategorySlug.PIERCING,
    description: `Surface piercing with a sterile single-use needle and fitted jewellery. ${WEDNESDAY_NOTE}`,
    durationMinutes: 10,
    price: 30,
    availableWeekdays: WED,
    displayOrder: 2,
  },
  {
    name: 'Dermal piercing',
    slug: 'dermal-piercing',
    category: ServiceCategorySlug.PIERCING,
    description: `Single-point dermal anchor placed with a sterile single-use needle. ${WEDNESDAY_NOTE}`,
    durationMinutes: 10,
    price: 40,
    availableWeekdays: WED,
    displayOrder: 3,
  },
  {
    name: 'Ear piercing',
    slug: 'ear-piercing',
    category: ServiceCategorySlug.PIERCING,
    description: `Ear piercing with a sterile single-use needle and fitted jewellery. ${WEDNESDAY_NOTE}`,
    durationMinutes: 10,
    price: 20,
    availableWeekdays: WED,
    displayOrder: 4,
  },
];

/**
 * The generic entries the priced variants replace. Deactivated rather than
 * deleted: any appointment already booked against one keeps a valid reference,
 * and reactivating is a single click if this turns out to be wrong.
 */
const RETIRE = ['botox'];

/**
 * Spelling corrections to the customer-facing names.
 *
 * Both of these were typed into the catalogue as misspellings of the actual
 * treatments — the lounge's own price list calls them "microblading" and
 * "nanoblading" — and the name is what a visitor reads on the treatment menu
 * and what the WhatsApp assistant repeats back when it quotes the $150.
 *
 * Only `name` changes. The slug is the stable key and stays as it is, so every
 * reference keeps resolving; and past appointments carry their own
 * `serviceNameSnapshot`, so nobody's booking history is rewritten by this.
 */
const RENAMES: { slug: string; name: string }[] = [
  { slug: 'microbalding', name: 'Microblading' },
  { slug: 'nano-balading', name: 'Nanoblading' },
];

const sameDays = (a: number[], b: number[]): boolean =>
  a.length === b.length && [...a].sort().every((day, index) => day === [...b].sort()[index]);

function describe(
  update: Update,
  before: { durationMinutes: number; price?: number; availableWeekdays: number[] },
): string[] {
  const parts: string[] = [];
  if (before.durationMinutes !== update.durationMinutes) {
    parts.push(`${before.durationMinutes}m → ${update.durationMinutes}m`);
  }
  if (update.price !== undefined && before.price !== update.price) {
    parts.push(`price ${before.price ?? '—'} → $${update.price}`);
  }
  // Only when it would actually change. A dry run that reports work it is not
  // going to do teaches the reader to skim past it, which defeats the purpose
  // of having a dry run at all.
  if (update.availableWeekdays && !sameDays(before.availableWeekdays, update.availableWeekdays)) {
    parts.push('Wednesdays only');
  }
  return parts;
}

async function main(): Promise<void> {
  await connectDatabase();
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — nothing will be written'}\n`);

  console.log('Updating existing treatments');
  for (const update of UPDATES) {
    const service = await Service.findOne({ slug: update.slug });
    if (!service) {
      console.log(`  ?  ${update.slug} — NOT FOUND, skipped`);
      continue;
    }

    const changes = describe(update, service);
    if (changes.length === 0) {
      console.log(`  =  ${update.slug} — already correct`);
      continue;
    }
    console.log(`  ~  ${update.slug} — ${changes.join(', ')}`);

    if (!APPLY) continue;
    service.durationMinutes = update.durationMinutes;
    if (update.price !== undefined) {
      service.price = update.price;
      service.currency = CURRENCY;
    }
    if (update.availableWeekdays) service.availableWeekdays = update.availableWeekdays;
    if (update.note && !service.description?.includes(update.note)) {
      service.description = `${service.description ?? ''} ${update.note}`.trim();
    }
    await service.save();
  }

  console.log('\nCreating missing treatments');
  for (const creation of CREATIONS) {
    const existing = await Service.findOne({ slug: creation.slug });
    if (existing) {
      console.log(`  =  ${creation.slug} — already exists`);
      continue;
    }
    console.log(
      `  +  ${creation.slug} — ${creation.durationMinutes}m, $${creation.price}, ${creation.category}` +
        `${creation.availableWeekdays ? ', Wednesdays only' : ''}`,
    );
    if (!APPLY) continue;
    await Service.create({
      ...creation,
      currency: CURRENCY,
      availableWeekdays: creation.availableWeekdays ?? [],
      isActive: true,
    });
  }

  console.log('\nCorrecting misspelled names');
  for (const rename of RENAMES) {
    const service = await Service.findOne({ slug: rename.slug });
    if (!service) {
      console.log(`  ?  ${rename.slug} — NOT FOUND, skipped`);
      continue;
    }
    if (service.name === rename.name) {
      console.log(`  =  ${rename.slug} — already "${rename.name}"`);
      continue;
    }
    console.log(`  ~  ${rename.slug} — "${service.name}" → "${rename.name}"`);
    if (!APPLY) continue;
    service.name = rename.name;
    await service.save();
  }

  console.log('\nRetiring superseded treatments');
  for (const slug of RETIRE) {
    const service = await Service.findOne({ slug });
    if (!service) {
      console.log(`  ?  ${slug} — NOT FOUND, skipped`);
      continue;
    }
    if (!service.isActive) {
      console.log(`  =  ${slug} — already inactive`);
      continue;
    }
    console.log(`  -  ${slug} — deactivating (replaced by priced variants)`);
    if (!APPLY) continue;
    service.isActive = false;
    await service.save();
  }

  console.log(`\n${APPLY ? 'Done.' : 'Dry run complete. Re-run with --apply to write.'}\n`);
  await disconnectDatabase();
  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close();
  process.exit(1);
});
