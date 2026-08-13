import type { Types } from 'mongoose';
import { Appointment } from '../models/Appointment';
import { ClientAsset } from '../models/ClientAsset';
import { ClientPhotoSet } from '../models/ClientPhotoSet';
import { Notification } from '../models/Notification';
import { PushSubscription } from '../models/PushSubscription';
import { User, normalizePhone, type UserDocument } from '../models/User';
import { UserRole } from '../types/domain';
import { ApiError, ErrorCode } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { storage } from './storage';
import { releaseSlot } from './slotLock.service';

/**
 * CLIENT RECORDS
 * --------------
 * Editing and erasure for the people the lounge treats. Both are more delicate
 * than they look: the phone number is a sign-in identifier, and a client record
 * is the root of treatment photographs, signed documents and appointment
 * history.
 */

interface UpdateClientInput {
  fullName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive?: boolean;
}

/** Guards the two sign-in identifiers against another account. */
async function assertIdentifiersAreFree(
  email: string | undefined,
  phone: string | undefined,
  excludeId: Types.ObjectId,
): Promise<void> {
  const clauses: Record<string, unknown>[] = [];
  if (email) clauses.push({ email });
  if (phone) clauses.push({ phoneNormalized: normalizePhone(phone) });
  if (clauses.length === 0) return;

  const clash = await User.findOne({ $or: clauses, _id: { $ne: excludeId } })
    .select('email phoneNormalized')
    .lean();
  if (!clash) return;

  throw ApiError.conflict(
    clash.email === email
      ? 'Another account already uses that email address.'
      : 'Another account already uses that phone number.',
    ErrorCode.EMAIL_IN_USE,
  );
}

export async function updateClient(
  clientId: string,
  input: UpdateClientInput,
): Promise<UserDocument> {
  const client = await User.findOne({ _id: clientId, role: UserRole.CLIENT });
  if (!client) throw ApiError.notFound('That client could not be found.');

  if (input.phone !== undefined || input.email !== undefined) {
    await assertIdentifiersAreFree(
      input.email ?? client.email,
      input.phone ?? client.phone,
      client._id,
    );
  }

  if (input.fullName !== undefined) client.fullName = input.fullName;
  if (input.phone !== undefined) client.phone = input.phone;
  // An explicitly cleared email is removed rather than stored empty — the
  // partial unique index treats "" as a value, and the second such client
  // would collide with the first.
  if (input.email !== undefined) client.email = input.email || undefined;
  if (input.notes !== undefined) client.clientProfile.notes = input.notes || undefined;
  if (input.isActive !== undefined) client.isActive = input.isActive;

  /**
   * Changing a sign-in identifier ends their sessions. Otherwise a client whose
   * number was corrected keeps a token minted against the old one, and the
   * lounge has no way to tell whether the person holding it is still them.
   */
  if (input.phone !== undefined || input.email !== undefined || input.isActive === false) {
    client.tokenVersion += 1;
  }

  await client.save();
  return client;
}

export interface DeleteClientSummary {
  appointments: number;
  photoSets: number;
  files: number;
}

/**
 * Erases a client and everything that belongs to them.
 *
 * This is a hard delete, not a deactivation — it exists for an erasure request
 * and for records created in error. The lounge's usual answer to "this client
 * has left" is *Deactivate*, which keeps their history intact.
 *
 * Order matters. The stored bytes go last: a row deleted without its file
 * leaves an orphan nobody can find, whereas a file deleted without its row
 * leaves a record that fails loudly on read. The second is recoverable, the
 * first is not.
 */
export async function deleteClient(
  clientId: string,
  actorId: Types.ObjectId,
): Promise<DeleteClientSummary> {
  const client = await User.findById(clientId).select('role fullName');
  if (!client) throw ApiError.notFound('That client could not be found.');
  if (client.role !== UserRole.CLIENT) {
    throw ApiError.badRequest('That account is a team member, not a client. Remove them from Staff.');
  }
  if (client._id.equals(actorId)) {
    throw ApiError.badRequest('You cannot delete your own account.');
  }

  // Slot locks are keyed by appointment, so each has to be released by hand
  // before the appointments go — otherwise the grid stays blocked for times
  // nobody holds any more.
  const appointments = await Appointment.find({ client: client._id }).select('_id').lean();
  await Promise.all(appointments.map((appointment) => releaseSlot(appointment._id)));

  /**
   * `ClientAsset.uploadedBy` and `ClientPhotoSet.createdBy` also reference a
   * User, but they name the *staff member* who filed the record, not its
   * subject — so they are no part of erasing a client, and the rows carrying
   * them are removed wholesale below regardless.
   */
  const assets = await ClientAsset.find({ client: client._id }).select('+storageKey').lean();

  const [appointmentResult, photoSetResult] = await Promise.all([
    Appointment.deleteMany({ client: client._id }),
    ClientPhotoSet.deleteMany({ client: client._id }),
    ClientAsset.deleteMany({ client: client._id }),
    Notification.deleteMany({ recipient: client._id }),
    PushSubscription.deleteMany({ user: client._id }),
  ]);

  await client.deleteOne();

  // Best-effort: a storage failure must not leave the account half-deleted,
  // having already reported success for the database half.
  await Promise.all(
    assets.map(async (asset) => {
      try {
        await storage.remove(asset.storageKey);
      } catch (error) {
        logger.error('Failed to remove a deleted client file', {
          assetId: asset._id.toString(),
          message: (error as Error).message,
        });
      }
    }),
  );

  logger.info('Client erased', {
    clientId: client._id.toString(),
    appointments: appointmentResult.deletedCount,
    files: assets.length,
  });

  return {
    appointments: appointmentResult.deletedCount ?? 0,
    photoSets: photoSetResult.deletedCount ?? 0,
    files: assets.length,
  };
}
