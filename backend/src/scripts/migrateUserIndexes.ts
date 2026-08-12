/**
 * Migrates the user sign-in indexes for optional email addresses.
 *
 * The original `email_1` index is unique but not partial, so it treats every
 * account without an address as a duplicate of the next — the second such
 * client could not be created at all. It is replaced with a partial unique
 * index that only constrains documents where `email` is actually a string.
 *
 * `phoneNormalized_1` is created at the same time: the phone number became a
 * sign-in identifier when the email stopped being mandatory, so two accounts
 * sharing one number would make sign-in ambiguous.
 *
 * Backfills `phoneNormalized` first — the unique index would otherwise be built
 * over documents that all have no value, and later writes would collide.
 *
 *   npm run migrate:user-indexes --workspace backend            # dry run
 *   npm run migrate:user-indexes:apply --workspace backend      # writes
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { User, normalizePhone } from '../models/User';

const APPLY = process.argv.includes('--apply');

const EMAIL_INDEX = 'email_1';
const PHONE_INDEX = 'phoneNormalized_1';

async function main(): Promise<void> {
  await connectDatabase();
  const collection = mongoose.connection.collection('users');
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — nothing will be written'}\n`);

  // --- 1. Backfill phoneNormalized ----------------------------------------
  const needsBackfill = await User.find({
    phone: { $exists: true, $ne: null },
    phoneNormalized: { $exists: false },
  })
    .select('phone')
    .lean();

  console.log(`Backfill phoneNormalized: ${needsBackfill.length} document(s)`);
  for (const user of needsBackfill) {
    const normalized = normalizePhone(user.phone as string);
    console.log(`  ~  ${user._id.toString()}  ${user.phone} → ${normalized}`);
    if (!APPLY) continue;
    await collection.updateOne({ _id: user._id }, { $set: { phoneNormalized: normalized } });
  }

  // A duplicate here would make the unique index fail to build, so it is worth
  // saying so plainly rather than letting Mongo raise an opaque error.
  const clashes = await collection
    .aggregate([
      { $match: { phoneNormalized: { $type: 'string' } } },
      { $group: { _id: '$phoneNormalized', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  if (clashes.length > 0) {
    console.log('\n  !! duplicate phone numbers — resolve these before applying:');
    for (const clash of clashes) console.log(`     ${clash._id} x${clash.n}`);
    if (APPLY) throw new Error('Refusing to build a unique index over duplicate phone numbers.');
  }

  // --- 2. Replace the indexes ---------------------------------------------
  const existing = await collection.indexes();
  const byName = new Map(existing.map((index) => [index.name, index]));

  const emailIndex = byName.get(EMAIL_INDEX);
  const emailIsPartial = Boolean(emailIndex?.partialFilterExpression);
  console.log(`\n${EMAIL_INDEX}: ${emailIndex ? (emailIsPartial ? 'already partial' : 'unique, NOT partial → replace') : 'missing → create'}`);
  if (APPLY && emailIndex && !emailIsPartial) {
    await collection.dropIndex(EMAIL_INDEX);
    console.log(`  -  dropped ${EMAIL_INDEX}`);
  }
  if (APPLY && (!emailIndex || !emailIsPartial)) {
    await collection.createIndex(
      { email: 1 },
      { unique: true, partialFilterExpression: { email: { $type: 'string' } }, name: EMAIL_INDEX },
    );
    console.log(`  +  created ${EMAIL_INDEX} (unique, partial)`);
  }

  const phoneIndex = byName.get(PHONE_INDEX);
  console.log(`${PHONE_INDEX}: ${phoneIndex ? 'already present' : 'missing → create'}`);
  if (APPLY && !phoneIndex) {
    await collection.createIndex(
      { phoneNormalized: 1 },
      {
        unique: true,
        partialFilterExpression: { phoneNormalized: { $type: 'string' } },
        name: PHONE_INDEX,
      },
    );
    console.log(`  +  created ${PHONE_INDEX} (unique, partial)`);
  }

  console.log('\nIndexes now:');
  for (const index of await collection.indexes()) {
    console.log(
      `   ${index.name}  unique=${index.unique ?? false}  partial=${JSON.stringify(index.partialFilterExpression ?? null)}`,
    );
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
