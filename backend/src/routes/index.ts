import { Router } from 'express';
import mongoose from 'mongoose';
import * as galleryController from '../controllers/gallery.controller';
import * as notificationController from '../controllers/notification.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../validators/appointment.validators';
import adminRoutes from './admin.routes';
import appointmentRoutes from './appointment.routes';
import authRoutes from './auth.routes';
import availabilityRoutes from './availability.routes';
import serviceRoutes from './service.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/availability', availabilityRoutes);
router.use('/appointments', appointmentRoutes);

router.get('/gallery', optionalAuth, galleryController.listGallery);

router.get('/notifications', requireAuth, notificationController.listNotifications);
router.post('/notifications/read-all', requireAuth, notificationController.markAllRead);
router.post(
  '/notifications/:id/read',
  requireAuth,
  validate({ params: idParamSchema }),
  notificationController.markRead,
);

router.use('/admin', adminRoutes);

export default router;
