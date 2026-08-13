/**
 * Provisions an owner (ADMIN) account.
 *
 * The Staff page cannot do this: `createStaff` hard-codes `role: STAFF`, so the
 * API is unable to grant unlimited access to itself however the request is
 * crafted. A second owner is therefore made here, from the server, by someone
 * who already holds the database credentials.
 *
 *   ADMIN_PASSWORD='…' npm run admin:create --workspace backend -- --name "Jane Doe" --phone "70 303 380"
 *   ADMIN_PASSWORD='…' npm run admin:create:apply --workspace backend -- --name "Jane Doe" --phone "70 303 380"
 *
 * The password is read from ADMIN_PASSWORD rather than a `--password` flag:
 * arguments land in shell history and are visible in the process list to every
 * other user on the machine.
 *
 * Safe to re-run. An account already holding the number is reported and left
 * untouched unless `--promote` is passed, which raises it to ADMIN and — when
 * ADMIN_PASSWORD is set — resets the password, ending its open sessions.
 */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db';
import { User, normalizePhone } from '../models/User';
import { UserRole } from '../types/domain';
import { email as emailSchema, phone as phoneSchema } from '../validators/common';
import { password as passwordSchema } from '../validators/staff.validators';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const PROMOTE = argv.includes('--promote');

/** Reads `--flag value`. Returns undefined when the flag is absent. */
function arg(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const name = arg('name');
  const rawPhone = arg('phone');
  const rawEmail = arg('email');
  const jobTitle = arg('job-title');
  const rawPassword = process.env.ADMIN_PASSWORD;

  if (!name) fail('--name is required.');
  if (!rawPhone) fail('--phone is required — it is how the owner signs in.');

  // The same schemas the API enforces, so an account made here can never be one
  // the admin UI would have rejected.
  const fullName = name.trim();
  if (fullName.length < 2) fail('--name must be at least 2 characters.');

  const phoneParsed = phoneSchema.safeParse(rawPhone);
  if (!phoneParsed.success) fail(phoneParsed.error.issues[0]?.message ?? 'Invalid phone number.');
  const phone = phoneParsed.data;
  const phoneNormalized = normalizePhone(phone);

  const emailParsed = rawEmail ? emailSchema.safeParse(rawEmail) : undefined;
  if (emailParsed && !emailParsed.success) {
    fail(emailParsed.error.issues[0]?.message ?? 'Invalid email address.');
  }
  const email = emailParsed?.data;

  if (rawPassword !== undefined) {
    const passwordParsed = passwordSchema.safeParse(rawPassword);
    if (!passwordParsed.success) {
      fail(passwordParsed.error.issues[0]?.message ?? 'Invalid password.');
    }
  } else if (!PROMOTE) {
    fail('Set ADMIN_PASSWORD in the environment (not as an argument).');
  }

  const connection = await connectDatabase();
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — nothing will be written'}`);
  console.log(
    `Database: ${connection.connection.name} @ ${connection.connection.host ?? 'unknown host'}`,
  );

  // Fingerprint the target: a count that matches expectations is how the
  // operator confirms this is the intended database and not a local copy.
  const [users, admins, staff, clients] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: UserRole.ADMIN }),
    User.countDocuments({ role: UserRole.STAFF }),
    User.countDocuments({ role: UserRole.CLIENT }),
  ]);
  console.log(`Users: ${users} total — ${admins} owner(s), ${staff} staff, ${clients} client(s)\n`);

  const loungeSide = await User.find({ role: { $in: [UserRole.ADMIN, UserRole.STAFF] } })
    .select('fullName role phone phoneNormalized email isActive')
    .sort({ role: 1, fullName: 1 })
    .lean();
  console.log('Existing lounge-side accounts:');
  for (const account of loungeSide) {
    console.log(
      `   ${account.role.padEnd(5)}  ${account.fullName.padEnd(24)}  ${account.phone ?? '—'}  ${account.email ?? ''}${account.isActive ? '' : '  (inactive)'}`,
    );
  }

  // --- Identifier collision -------------------------------------------------
  const clauses: Record<string, unknown>[] = [{ phoneNormalized }];
  if (email) clauses.push({ email });
  const existing = await User.findOne({ $or: clauses });

  console.log(`\nTarget: ${fullName}  ${phone}  → phoneNormalized ${phoneNormalized}`);

  if (existing && !PROMOTE) {
    console.log(
      `\n  !! ${existing.email === email && email ? 'That email address' : 'That phone number'} already belongs to ${existing.fullName} (${existing.role}).`,
    );
    console.log('     Re-run with --promote to raise that account to owner instead.\n');
    await mongoose.connection.close();
    process.exit(1);
  }

  if (existing) {
    console.log(`\n  ~  promoting ${existing.fullName} (${existing.role} → ADMIN)`);
    if (APPLY) {
      existing.role = UserRole.ADMIN;
      existing.isActive = true;
      // An owner is allowed everything unconditionally; leaving stale rows here
      // would be a second source of truth that could later disagree.
      existing.staffPermissions = [];
      if (rawPassword) {
        existing.passwordHash = await User.hashPassword(rawPassword);
        existing.tokenVersion += 1; // ends every session opened under the old password
        console.log('     password reset — existing sessions signed out');
      }
      await existing.save();
      console.log(`  ✓  ${existing.fullName} is now an owner (${existing.id})`);
    }
  } else {
    console.log(`\n  +  creating owner ${fullName}`);
    if (APPLY) {
      const owner = new User({
        fullName,
        phone,
        ...(email ? { email } : {}),
        ...(jobTitle ? { jobTitle } : {}),
        passwordHash: await User.hashPassword(rawPassword as string),
        role: UserRole.ADMIN,
        isActive: true,
        staffPermissions: [],
      });
      await owner.save();
      console.log(`  ✓  created ${owner.fullName} (${owner.id})`);
      console.log(`     signs in with ${owner.phone}${email ? ` or ${email}` : ''}`);
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
