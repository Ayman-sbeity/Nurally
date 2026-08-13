import { Types } from 'mongoose';
import { PushSubscription } from '../models/PushSubscription';
import { User, normalizePhone, type UserDocument } from '../models/User';
import { UserRole, normalizePermissions, type StaffPermission } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import type { CreateStaffInput, UpdateStaffInput } from '../validators/staff.validators';

/**
 * EMPLOYEE ACCOUNTS
 * -----------------
 * Staff are `User` records with `role: STAFF` rather than a separate
 * collection: they sign in through the same flow, are notified through the same
 * inbox, and appear in appointment history alongside everyone else. A parallel
 * collection would have meant duplicating all of that.
 *
 * Every function here is reachable only by the owner (see `admin.routes.ts`).
 */

const STAFF_FIELDS = 'fullName email phone jobTitle role isActive staffPermissions lastLoginAt createdAt avatarUpdatedAt';

/** Guards both sign-in identifiers against an existing account. */
async function assertIdentifiersAreFree(
  email: string | undefined,
  phone: string | undefined,
  excludeId?: Types.ObjectId,
): Promise<void> {
  const clauses: Record<string, unknown>[] = [];
  if (email) clauses.push({ email });
  if (phone) clauses.push({ phoneNormalized: normalizePhone(phone) });
  if (clauses.length === 0) return;

  const filter: Record<string, unknown> = { $or: clauses };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await User.findOne(filter).select('email phoneNormalized').lean();
  if (!clash) return;

  throw ApiError.conflict(
    clash.email === email
      ? 'An account with that email address already exists.'
      : 'An account with that phone number already exists.',
  );
}

export async function listStaff() {
  // Admins are included so the owner sees the full team, and so a second owner
  // account is never invisible from the page that manages access.
  return User.find({ role: { $in: [UserRole.STAFF, UserRole.ADMIN] } })
    .select(STAFF_FIELDS)
    .sort({ role: 1, fullName: 1 })
    .lean();
}

export async function getStaff(id: string) {
  const staff = await User.findOne({
    _id: id,
    role: { $in: [UserRole.STAFF, UserRole.ADMIN] },
  })
    .select(STAFF_FIELDS)
    .lean();

  if (!staff) throw ApiError.notFound('That team member could not be found.');
  return staff;
}

export async function createStaff(input: CreateStaffInput): Promise<UserDocument> {
  await assertIdentifiersAreFree(input.email ?? undefined, input.phone);

  const staff = new User({
    fullName: input.fullName,
    phone: input.phone,
    // Omitted when blank rather than stored empty: the unique index on email is
    // partial, and a second employee with `''` would collide with the first.
    ...(input.email ? { email: input.email } : {}),
    ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
    passwordHash: await User.hashPassword(input.password),
    role: UserRole.STAFF,
    isActive: true,
    staffPermissions: normalizePermissions(input.permissions as StaffPermission[]),
  });

  await staff.save();
  return staff;
}

export async function updateStaff(
  id: string,
  input: UpdateStaffInput,
  actorId: Types.ObjectId,
): Promise<UserDocument> {
  /**
   * Loaded whole, deliberately. A projection here would leave `tokenVersion`
   * undefined, and the session-invalidation below increments it — turning a
   * permission change into a NaN write that locks the employee out for good.
   */
  const staff = await User.findById(id);
  if (!staff) throw ApiError.notFound('That team member could not be found.');
  if (staff.role === UserRole.CLIENT) {
    throw ApiError.badRequest('That account is a client, not a team member.');
  }

  const isSelf = staff._id.equals(actorId);

  // The owner's own account is the one that can never be locked out or stripped
  // of access, so the two fields that could do it are refused rather than
  // silently ignored.
  if (staff.role === UserRole.ADMIN) {
    if (input.permissions) {
      throw ApiError.badRequest('The owner account always has full access; it cannot be limited.');
    }
    if (input.isActive === false) {
      throw ApiError.badRequest('The owner account cannot be deactivated.');
    }
  }
  if (isSelf && input.isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account.');
  }

  if (input.email !== undefined || input.phone !== undefined) {
    await assertIdentifiersAreFree(
      input.email === undefined ? staff.email : (input.email ?? undefined),
      input.phone ?? staff.phone,
      staff._id,
    );
  }

  if (input.fullName !== undefined) staff.fullName = input.fullName;
  // `null` means the owner cleared the field; `undefined` means they did not
  // send it at all. Only the first should erase what is stored.
  if (input.email !== undefined) staff.email = input.email ?? undefined;
  if (input.phone !== undefined) staff.phone = input.phone;
  if (input.jobTitle !== undefined) staff.jobTitle = input.jobTitle || undefined;
  if (input.isActive !== undefined) staff.isActive = input.isActive;
  if (input.permissions !== undefined && staff.role === UserRole.STAFF) {
    staff.staffPermissions = normalizePermissions(input.permissions as StaffPermission[]);
  }

  if (input.password) {
    staff.passwordHash = await User.hashPassword(input.password);
    // Every existing session of theirs stops working, which is the point of an
    // owner resetting a password rather than the employee changing their own.
    staff.tokenVersion += 1;
  }

  /**
   * Narrowing access has to reach sessions that are already open, or an
   * employee who was mid-shift keeps the old permissions until their access
   * token happens to expire. Bumping the version forces a refresh, which
   * re-reads the account.
   */
  if (input.permissions !== undefined || input.isActive === false) {
    staff.tokenVersion += 1;
  }

  await staff.save();
  return staff;
}

export async function deleteStaff(id: string, actorId: Types.ObjectId): Promise<void> {
  const staff = await User.findById(id).select('role');
  if (!staff) throw ApiError.notFound('That team member could not be found.');
  if (staff._id.equals(actorId)) throw ApiError.badRequest('You cannot delete your own account.');
  if (staff.role === UserRole.ADMIN) {
    throw ApiError.badRequest('The owner account cannot be deleted.');
  }
  if (staff.role !== UserRole.STAFF) {
    throw ApiError.badRequest('That account is a client, not a team member.');
  }

  /**
   * Appointment history references staff by id and is deliberately left intact:
   * "confirmed by" on a past appointment is a record of what happened, and it
   * should not change because someone later left. Their push subscriptions do
   * go, so a deleted account's phone stops receiving the lounge's alerts.
   */
  await PushSubscription.deleteMany({ user: staff._id });
  await staff.deleteOne();
}
