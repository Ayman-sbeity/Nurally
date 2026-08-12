import type { Types } from 'mongoose';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import {
  AdminResource,
  NotificationChannel,
  NotificationType,
  PermissionAction,
  UserRole,
  isLoungeSide,
} from '../types/domain';
import { logger } from '../utils/logger';
import { isPushEnabled, sendToUser } from './push.service';

interface CreateNotificationInput {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  appointment?: Types.ObjectId;
  /** Extra channels to queue alongside the in-app entry. */
  channels?: NotificationChannel[];
  /**
   * Which app the recipient reads, so a tapped push lands on their own screen
   * for the appointment. Defaults to the client app — every caller but
   * `notifyAdmins` is notifying a client.
   */
  recipientRole?: UserRole;
}

/**
 * Deep link for a tapped notification. The two apps are separate route trees,
 * so the same appointment has a different address for each side.
 */
function linkFor(input: CreateNotificationInput): string {
  const loungeSide = input.recipientRole ? isLoungeSide(input.recipientRole) : false;
  if (!input.appointment) return loungeSide ? '/admin' : '/app';
  return loungeSide
    ? `/admin/appointments/${input.appointment.toString()}`
    : `/app/appointments/${input.appointment.toString()}`;
}

/**
 * In-app notifications are written synchronously; any additional channel is
 * recorded as a delivery row.
 *
 * Web Push is attempted inline when VAPID keys are configured, and its delivery
 * row is settled with the outcome. It is deliberately not allowed to fail the
 * caller: a booking must still succeed when a push service is unreachable.
 * Email/SMS/WhatsApp remain PENDING for a future worker to drain.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const pushable = isPushEnabled();
  const channels = Array.from(
    new Set([
      NotificationChannel.IN_APP,
      ...(pushable ? [NotificationChannel.PUSH] : []),
      ...(input.channels ?? []),
    ]),
  );

  const notification = await Notification.create({
    recipient: input.recipient,
    type: input.type,
    title: input.title,
    body: input.body,
    ...(input.appointment ? { appointment: input.appointment } : {}),
    channels,
    deliveries: channels
      .filter((channel) => channel !== NotificationChannel.IN_APP)
      .map((channel) => ({ channel, status: 'PENDING' as const })),
  });

  if (!pushable) return;

  try {
    const delivered = await sendToUser(input.recipient, {
      title: input.title,
      body: input.body,
      url: linkFor(input),
      // One appointment's updates replace each other on the lock screen rather
      // than stacking into a pile the recipient has to dismiss one by one.
      tag: input.appointment ? `appointment-${input.appointment.toString()}` : input.type,
    });

    // Zero devices is recorded as FAILED rather than SENT — the push channel
    // genuinely did not deliver. It is not an incident, though: it usually just
    // means the recipient has never turned notifications on, and the in-app
    // entry above still reached them.
    await Notification.updateOne(
      { _id: notification._id, 'deliveries.channel': NotificationChannel.PUSH },
      {
        $set: {
          'deliveries.$.status': delivered > 0 ? 'SENT' : 'FAILED',
          'deliveries.$.sentAt': new Date(),
          ...(delivered > 0
            ? {}
            : { 'deliveries.$.error': 'No registered device accepted the push.' }),
        },
      },
    );
  } catch (error) {
    logger.error('Push notification failed', error);
  }
}

/**
 * Fans a notification out to everyone who works the desk: the owner, and any
 * employee granted sight of appointments.
 *
 * Staff are filtered by permission rather than by role alone — someone who only
 * maintains the gallery has no use for a booking alert, and telling them about
 * a named client's treatment would leak a detail they were not given access to.
 */
export async function notifyAdmins(
  input: Omit<CreateNotificationInput, 'recipient'>,
): Promise<void> {
  const recipients = await User.find({
    isActive: true,
    $or: [
      { role: UserRole.ADMIN },
      {
        role: UserRole.STAFF,
        staffPermissions: {
          $elemMatch: {
            resource: AdminResource.APPOINTMENTS,
            actions: PermissionAction.VIEW,
          },
        },
      },
    ],
  })
    .select('_id role')
    .lean();

  if (recipients.length === 0) {
    logger.warn('No active admin to notify', { type: input.type });
    return;
  }
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({ ...input, recipient: recipient._id, recipientRole: recipient.role }),
    ),
  );
}

export async function listNotifications(
  recipient: Types.ObjectId,
  options: { unreadOnly?: boolean; limit?: number } = {},
) {
  const filter: Record<string, unknown> = { recipient };
  if (options.unreadOnly) filter.readAt = { $exists: false };

  return Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(options.limit ?? 50, 100))
    .lean();
}

export async function countUnread(recipient: Types.ObjectId): Promise<number> {
  return Notification.countDocuments({ recipient, readAt: { $exists: false } });
}

export async function markAsRead(
  recipient: Types.ObjectId,
  notificationId: string,
): Promise<boolean> {
  const result = await Notification.updateOne(
    { _id: notificationId, recipient, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  return result.matchedCount > 0;
}

export async function markAllAsRead(recipient: Types.ObjectId): Promise<number> {
  const result = await Notification.updateMany(
    { recipient, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
}
