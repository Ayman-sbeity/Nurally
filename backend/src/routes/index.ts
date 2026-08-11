import { Router } from 'express';
import mongoose from 'mongoose';
import * as galleryController from '../controllers/gallery.controller';
import * as mediaController from '../controllers/media.controller';
import * as notificationController from '../controllers/notification.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../validators/appointment.validators';
import adminRoutes from './admin.routes';
import appointmentRoutes from './appointment.routes';
import authRoutes from './auth.routes';
import availabilityRoutes from './availability.routes';
import serviceRoutes from './service.routes';
import userRoutes from './user.routes';

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
router.use('/users', userRoutes);
router.use('/availability', availabilityRoutes);
router.use('/appointments', appointmentRoutes);

router.get('/gallery', optionalAuth, galleryController.listGallery);

// Website artwork uploaded through the admin. Public by design — these images
// are rendered on pages visitors read while signed out. The controller can only
// reach the `public/` area of storage, never a client's photographs.
router.get('/media/:year/:month/:file', mediaController.streamPublicImage);

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
