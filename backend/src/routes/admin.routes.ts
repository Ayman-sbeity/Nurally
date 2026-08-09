import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as appointmentController from '../controllers/appointment.controller';
import * as availabilityController from '../controllers/availability.controller';
import * as galleryController from '../controllers/gallery.controller';
import * as serviceController from '../controllers/service.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UserRole } from '../types/domain';
import {
  approveSchema,
  idParamSchema,
  listAppointmentsQuerySchema,
  offerTimeSchema,
  reasonSchema,
  rescheduleByAdminSchema,
} from '../validators/appointment.validators';
import {
  createBlockedPeriodSchema,
  listBlockedPeriodsQuerySchema,
  updateWorkingHoursSchema,
} from '../validators/availability.validators';
import {
  createGalleryImageSchema,
  createServiceSchema,
  listClientsQuerySchema,
  reorderSchema,
  updateClientSchema,
  updateGalleryImageSchema,
  updateServiceSchema,
} from '../validators/catalogue.validators';

const router = Router();

// Single gate for the whole admin surface.
router.use(requireAuth, requireRole(UserRole.ADMIN));

// --- Overview --------------------------------------------------------------
router.get('/dashboard', adminController.getDashboard);
router.get('/calendar', adminController.getCalendar);

// --- Appointments ----------------------------------------------------------
router.get(
  '/appointments',
  validate({ query: listAppointmentsQuerySchema }),
  appointmentController.listAllAppointments,
);
router.get(
  '/appointments/:id',
  validate({ params: idParamSchema }),
  appointmentController.getAppointment,
);
router.post(
  '/appointments/:id/approve',
  validate({ params: idParamSchema, body: approveSchema }),
  appointmentController.approve,
);
router.post(
  '/appointments/:id/reject',
  validate({ params: idParamSchema, body: reasonSchema }),
  appointmentController.reject,
);
router.post(
  '/appointments/:id/offer-time',
  validate({ params: idParamSchema, body: offerTimeSchema }),
  appointmentController.offerTime,
);
router.post(
  '/appointments/:id/reschedule',
  validate({ params: idParamSchema, body: rescheduleByAdminSchema }),
  appointmentController.reschedule,
);
router.post(
  '/appointments/:id/approve-reschedule',
  validate({ params: idParamSchema }),
  appointmentController.approveReschedule,
);
router.post(
  '/appointments/:id/complete',
  validate({ params: idParamSchema }),
  appointmentController.complete,
);
router.post(
  '/appointments/:id/no-show',
  validate({ params: idParamSchema }),
  appointmentController.noShow,
);
router.post(
  '/appointments/:id/cancel',
  validate({ params: idParamSchema, body: reasonSchema }),
  appointmentController.cancelAppointment,
);

// --- Clients ---------------------------------------------------------------
router.get('/clients', validate({ query: listClientsQuerySchema }), adminController.listClients);
router.get('/clients/:id', validate({ params: idParamSchema }), adminController.getClient);
router.patch(
  '/clients/:id',
  validate({ params: idParamSchema, body: updateClientSchema }),
  adminController.updateClient,
);

// --- Services --------------------------------------------------------------
router.post('/services', validate({ body: createServiceSchema }), serviceController.createService);
router.post('/services/reorder', validate({ body: reorderSchema }), serviceController.reorderServices);
router.patch(
  '/services/:id',
  validate({ params: idParamSchema, body: updateServiceSchema }),
  serviceController.updateService,
);
router.delete(
  '/services/:id',
  validate({ params: idParamSchema }),
  serviceController.deleteService,
);

// --- Availability ----------------------------------------------------------
router.get('/availability/working-hours', availabilityController.listWorkingHours);
router.put(
  '/availability/working-hours',
  validate({ body: updateWorkingHoursSchema }),
  availabilityController.updateWorkingHours,
);
router.get(
  '/availability/blocked',
  validate({ query: listBlockedPeriodsQuerySchema }),
  availabilityController.listBlockedPeriods,
);
router.post(
  '/availability/blocked',
  validate({ body: createBlockedPeriodSchema }),
  availabilityController.createBlockedPeriod,
);
router.delete(
  '/availability/blocked/:id',
  validate({ params: idParamSchema }),
  availabilityController.deleteBlockedPeriod,
);

// --- Gallery ---------------------------------------------------------------
router.post(
  '/gallery',
  validate({ body: createGalleryImageSchema }),
  galleryController.createGalleryImage,
);
router.post('/gallery/reorder', validate({ body: reorderSchema }), galleryController.reorderGallery);
router.patch(
  '/gallery/:id',
  validate({ params: idParamSchema, body: updateGalleryImageSchema }),
  galleryController.updateGalleryImage,
);
router.delete(
  '/gallery/:id',
  validate({ params: idParamSchema }),
  galleryController.deleteGalleryImage,
);

export default router;
