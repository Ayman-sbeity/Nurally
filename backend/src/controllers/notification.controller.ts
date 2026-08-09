import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
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
