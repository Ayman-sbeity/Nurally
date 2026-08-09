import type { Types } from 'mongoose';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { NotificationChannel, NotificationType, UserRole } from '../types/domain';
import { logger } from '../utils/logger';

interface CreateNotificationInput {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  appointment?: Types.ObjectId;
  /** Extra channels to queue alongside the in-app entry. */
  channels?: NotificationChannel[];
}

/**
 * In-app notifications are written synchronously; any additional channel is
 * recorded as a PENDING delivery row.
 *
 * No external provider is wired in — email/SMS/WhatsApp/push become a matter of
 * adding a worker that drains PENDING deliveries once credentials exist.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const channels = input.channels?.length
    ? Array.from(new Set([NotificationChannel.IN_APP, ...input.channels]))
    : [NotificationChannel.IN_APP];

  await Notification.create({
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
}

/** Fans a notification out to every active admin. */
export async function notifyAdmins(
  input: Omit<CreateNotificationInput, 'recipient'>,
): Promise<void> {
  const admins = await User.find({ role: UserRole.ADMIN, isActive: true }).select('_id').lean();
  if (admins.length === 0) {
    logger.warn('No active admin to notify', { type: input.type });
    return;
  }
  await Promise.all(
    admins.map((admin) => createNotification({ ...input, recipient: admin._id })),
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
