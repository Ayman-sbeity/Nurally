import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as appointmentController from '../controllers/appointment.controller';
import * as availabilityController from '../controllers/availability.controller';
import * as clientAssetController from '../controllers/clientAsset.controller';
import * as galleryController from '../controllers/gallery.controller';
import * as mediaController from '../controllers/media.controller';
import * as serviceController from '../controllers/service.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { singleUpload } from '../middleware/upload';
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
import {
  assetIdParamSchema,
  createClientSchema,
  createPhotoSetSchema,
  setIdParamSchema,
  updatePhotoSetSchema,
  uploadDocumentSchema,
  uploadPhotoSchema,
} from '../validators/clientAsset.validators';

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
router.post('/clients', validate({ body: createClientSchema }), clientAssetController.createClient);
router.get('/clients/:id', validate({ params: idParamSchema }), adminController.getClient);
router.patch(
  '/clients/:id',
  validate({ params: idParamSchema, body: updateClientSchema }),
  adminController.updateClient,
);

// --- Client media ----------------------------------------------------------
// Before/after records group the photographs for one treatment, so consent and
// context are recorded once for the pair rather than per image.
router.get(
  '/clients/:id/photo-sets',
  validate({ params: idParamSchema }),
  clientAssetController.listPhotoSets,
);
router.post(
  '/clients/:id/photo-sets',
  validate({ params: idParamSchema, body: createPhotoSetSchema }),
  clientAssetController.createPhotoSet,
);
router.patch(
  '/photo-sets/:setId',
  validate({ params: setIdParamSchema, body: updatePhotoSetSchema }),
  clientAssetController.updatePhotoSet,
);
router.delete(
  '/photo-sets/:setId',
  validate({ params: setIdParamSchema }),
  clientAssetController.removePhotoSet,
);

// `singleUpload` runs before `validate` so multipart text fields are parsed and
// available on req.body by the time the schema sees them.
router.post(
  '/clients/:id/photo-sets/:setId/photos',
  singleUpload('file'),
  validate({ body: uploadPhotoSchema }),
  clientAssetController.uploadPhoto,
);

router.get(
  '/clients/:id/documents',
  validate({ params: idParamSchema }),
  clientAssetController.listDocuments,
);
router.post(
  '/clients/:id/documents',
  singleUpload('file'),
  validate({ body: uploadDocumentSchema }),
  clientAssetController.uploadDocument,
);

router.get(
  '/assets/:assetId/file',
  validate({ params: assetIdParamSchema }),
  clientAssetController.streamAsset,
);
router.delete(
  '/assets/:assetId',
  validate({ params: assetIdParamSchema }),
  clientAssetController.removeAsset,
);

// --- Website media ---------------------------------------------------------
// One uploader for every public image field in the admin. It returns a URL the
// caller saves onto the record it is editing.
router.post('/media/images', singleUpload('file'), mediaController.uploadImage);

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
