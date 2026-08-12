import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import * as pushService from '../services/push.service';
import { isLoungeSide } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const unreadOnly = req.query.unreadOnly === 'true';

  const [notifications, unreadCount] = await Promise.all([
    notificationService.listNotifications(req.user._id, { unreadOnly }),
    notificationService.countUnread(req.user._id),
  ]);

  ok(res, { notifications, unreadCount });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const updated = await notificationService.markAsRead(req.user._id, req.params.id as string);
  if (!updated) throw ApiError.notFound('That notification could not be found.');
  ok(res, { message: 'Marked as read.' });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const count = await notificationService.markAllAsRead(req.user._id);
  ok(res, { message: `${count} notification(s) marked as read.`, count });
});

// ---------------------------------------------------------------------------
// Web Push
// ---------------------------------------------------------------------------

/**
 * The VAPID public key the browser needs before it can subscribe, plus whether
 * this deployment can push at all — so the UI hides the toggle rather than
 * offering a switch that could never work.
 */
export const getPushConfig = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  ok(res, {
    enabled: pushService.isPushEnabled(),
    publicKey: pushService.getPublicKey(),
    devices: pushService.isPushEnabled()
      ? await pushService.countSubscriptions(req.user._id)
      : 0,
  });
});

export const subscribePush = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!pushService.isPushEnabled()) {
    throw ApiError.badRequest('Push notifications are not configured on this server.');
  }

  await pushService.saveSubscription(req.user._id, req.body, req.get('user-agent'));
  ok(res, { message: 'This device will now receive notifications.' });
});

export const unsubscribePush = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await pushService.removeSubscription(req.user._id, req.body.endpoint);
  // Deleting an endpoint that is already gone is the state the caller wanted.
  ok(res, { message: 'This device will no longer receive notifications.' });
});

/**
 * Sends a test push to the caller's own devices. The lounge owner should not
 * have to wait for a real booking to find out whether their phone rings.
 */
export const sendTestPush = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!pushService.isPushEnabled()) {
    throw ApiError.badRequest('Push notifications are not configured on this server.');
  }

  const delivered = await pushService.sendToUser(req.user._id, {
    title: 'Nurella test notification',
    body: 'Notifications are working. New booking requests will appear like this.',
    url: isLoungeSide(req.user.role) ? '/admin/appointments' : '/app/notifications',
    tag: 'nurella-test',
  });

  if (delivered === 0) {
    throw ApiError.badRequest(
      'No device is registered for notifications yet. Enable them on this device first.',
    );
  }

  ok(res, { message: `Test notification sent to ${delivered} device(s).`, delivered });
});
