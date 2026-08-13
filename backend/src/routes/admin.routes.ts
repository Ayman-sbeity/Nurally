import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as appointmentController from '../controllers/appointment.controller';
import * as availabilityController from '../controllers/availability.controller';
import * as clientAssetController from '../controllers/clientAsset.controller';
import * as galleryController from '../controllers/gallery.controller';
import * as instagramController from '../controllers/instagram.controller';
import * as mediaController from '../controllers/media.controller';
import * as serviceController from '../controllers/service.controller';
import * as staffController from '../controllers/staff.controller';
import {
  requireAdminArea,
  requireAuth,
  requireOwner,
  requirePermission,
} from '../middleware/auth';
import { singleUpload, singleVideoUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { AdminResource, PermissionAction } from '../types/domain';
import { createStaffSchema, updateStaffSchema } from '../validators/staff.validators';
import {
  adminCreateAppointmentSchema,
  approveSchema,
  editAppointmentSchema,
  idParamSchema,
  listAppointmentsQuerySchema,
  offerTimeSchema,
  reasonSchema,
  rescheduleByAdminSchema,
} from '../validators/appointment.validators';
import {
  availabilityQuerySchema,
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
  createReelSchema,
  lookupReelSchema,
  updateReelSchema,
} from '../validators/instagram.validators';
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

/**
 * Two-stage gate for the whole admin surface.
 *
 * `requireAdminArea` establishes that the caller works here at all; the
 * `requirePermission` on each route below decides whether *this* employee may
 * make *this* request. The owner passes both unconditionally.
 */
router.use(requireAuth, requireAdminArea);

/** Shorthand so each route reads as "section, action". */
const may = (resource: AdminResource, action: PermissionAction) =>
  requirePermission(resource, action);

const { VIEW, CREATE, EDIT, DELETE } = PermissionAction;

// --- Overview --------------------------------------------------------------
router.get('/dashboard', may(AdminResource.DASHBOARD, VIEW), adminController.getDashboard);
router.get('/calendar', may(AdminResource.CALENDAR, VIEW), adminController.getCalendar);

// --- Appointments ----------------------------------------------------------
router.get(
  '/appointments',
  may(AdminResource.APPOINTMENTS, VIEW),
  validate({ query: listAppointmentsQuerySchema }),
  appointmentController.listAllAppointments,
);
router.post(
  '/appointments',
  may(AdminResource.APPOINTMENTS, CREATE),
  validate({ body: adminCreateAppointmentSchema }),
  appointmentController.createForClient,
);
router.get(
  '/appointments/:id',
  may(AdminResource.APPOINTMENTS, VIEW),
  validate({ params: idParamSchema }),
  appointmentController.getAppointment,
);
// Every status move is an edit of an existing appointment, so they share one
// permission: an employee who may run the desk may run all of it.
router.post(
  '/appointments/:id/approve',
  may(AdminResource.APPOINTMENTS, EDIT),
  validate({ params: idParamSchema, body: approveSchema }),
  appointmentController.approve,
);
router.post(
  '/appointments/:id/reject',
  may(AdminResource.APPOINTMENTS, EDIT),
  validate({ params: idParamSchema, body: reasonSchema }),
  appointmentController.reject,
);
router.post(
  '/appointments/:id/offer-time',
  may(AdminResource.APPOINTMENTS, EDIT),
  validate({ params: idParamSchema, body: offerTimeSchema }),
  appointmentController.offerTime,
);
router.post(
  '/appointments/:id/reschedule',
  may(AdminResource.APPOINTMENTS, EDIT),
  validate({ params: idParamSchema, body: rescheduleByAdminSchema }),
  appointmentController.reschedule,
);
router.post(
  '/appointments/:id/approve-reschedule',
  may(AdminResource.APPOINTMENTS, EDIT),
  validate({ params: idParamSchema }),
  appointmentController.approveReschedule,
);
router.post(
  '/appointments/:id/complete',
  may(AdminResource.APPOINTMENTS, EDIT),
  validate({ params: idParamSchema }),
  appointmentController.complete,
);
router.post(
  '/appointments/:id/no-show',
  may(AdminResource.APPOINTMENTS, EDIT),
  validate({ params: idParamSchema }),
  appointmentController.noShow,
);
// Correcting a booking taken down wrong: its treatment, its time, its notes.
// Distinct from the status moves above, and from `reschedule`, which announces
// a move to the client rather than fixing a mistake.
router.patch(
  '/appointments/:id',
  may(AdminResource.APPOINTMENTS, EDIT),
  validate({ params: idParamSchema, body: editAppointmentSchema }),
  appointmentController.edit,
);

// Permanent, and not the same as cancelling — this is for a duplicate or a
// booking made against the wrong client, where the record should not survive.
router.delete(
  '/appointments/:id',
  may(AdminResource.APPOINTMENTS, DELETE),
  validate({ params: idParamSchema }),
  appointmentController.remove,
);

// Cancelling ends an appointment rather than editing it, so it is the one desk
// action an employee can be trusted with the rest of and still be held back from.
router.post(
  '/appointments/:id/cancel',
  may(AdminResource.APPOINTMENTS, DELETE),
  validate({ params: idParamSchema, body: reasonSchema }),
  appointmentController.cancelAppointment,
);

// --- Clients ---------------------------------------------------------------
router.get(
  '/clients',
  may(AdminResource.CLIENTS, VIEW),
  validate({ query: listClientsQuerySchema }),
  adminController.listClients,
);
router.post(
  '/clients',
  may(AdminResource.CLIENTS, CREATE),
  validate({ body: createClientSchema }),
  clientAssetController.createClient,
);
router.get(
  '/clients/:id',
  may(AdminResource.CLIENTS, VIEW),
  validate({ params: idParamSchema }),
  adminController.getClient,
);
router.patch(
  '/clients/:id',
  may(AdminResource.CLIENTS, EDIT),
  validate({ params: idParamSchema, body: updateClientSchema }),
  adminController.updateClient,
);

/**
 * Erasure, not deactivation: removes the client with their appointments,
 * treatment photographs, documents and notifications. Deactivating is the
 * everyday action and keeps the history — this is for an erasure request.
 */
router.delete(
  '/clients/:id',
  may(AdminResource.CLIENTS, DELETE),
  validate({ params: idParamSchema }),
  adminController.deleteClient,
);

/**
 * The lounge's stand-in for a self-service reset: no mail or SMS transport
 * exists, so the desk sets a temporary password and reads it to the client.
 * EDIT rather than a permission of its own — an employee trusted to change a
 * client's record is trusted to help them back into it.
 */
router.post(
  '/clients/:id/reset-password',
  may(AdminResource.CLIENTS, EDIT),
  validate({ params: idParamSchema }),
  adminController.resetClientPassword,
);

// --- Client media ----------------------------------------------------------
// Before/after records group the photographs for one treatment, so consent and
// context are recorded once for the pair rather than per image.
//
// These are treatment photographs and signed documents — the most sensitive
// data in the system — so they follow the client permission exactly rather
// than being reachable by anyone who can open a client record.
router.get(
  '/clients/:id/photo-sets',
  may(AdminResource.CLIENTS, VIEW),
  validate({ params: idParamSchema }),
  clientAssetController.listPhotoSets,
);
router.post(
  '/clients/:id/photo-sets',
  may(AdminResource.CLIENTS, CREATE),
  validate({ params: idParamSchema, body: createPhotoSetSchema }),
  clientAssetController.createPhotoSet,
);
router.patch(
  '/photo-sets/:setId',
  may(AdminResource.CLIENTS, EDIT),
  validate({ params: setIdParamSchema, body: updatePhotoSetSchema }),
  clientAssetController.updatePhotoSet,
);
router.delete(
  '/photo-sets/:setId',
  may(AdminResource.CLIENTS, DELETE),
  validate({ params: setIdParamSchema }),
  clientAssetController.removePhotoSet,
);

// `singleUpload` runs before `validate` so multipart text fields are parsed and
// available on req.body by the time the schema sees them. The permission check
// runs before either, so an unauthorised upload is refused without the bytes
// ever being written to disk.
router.post(
  '/clients/:id/photo-sets/:setId/photos',
  may(AdminResource.CLIENTS, CREATE),
  singleUpload('file'),
  validate({ body: uploadPhotoSchema }),
  clientAssetController.uploadPhoto,
);

router.get(
  '/clients/:id/documents',
  may(AdminResource.CLIENTS, VIEW),
  validate({ params: idParamSchema }),
  clientAssetController.listDocuments,
);
router.post(
  '/clients/:id/documents',
  may(AdminResource.CLIENTS, CREATE),
  singleUpload('file'),
  validate({ body: uploadDocumentSchema }),
  clientAssetController.uploadDocument,
);

router.get(
  '/assets/:assetId/file',
  may(AdminResource.CLIENTS, VIEW),
  validate({ params: assetIdParamSchema }),
  clientAssetController.streamAsset,
);
router.delete(
  '/assets/:assetId',
  may(AdminResource.CLIENTS, DELETE),
  validate({ params: assetIdParamSchema }),
  clientAssetController.removeAsset,
);

// --- Website media ---------------------------------------------------------
// One uploader for every public image field in the admin. It returns a URL the
// caller saves onto the record it is editing.
//
// Open to anyone lounge-side who can edit *something*: the destination record
// enforces its own permission when the returned URL is saved, and an orphaned
// upload to the public media area is harmless on its own.
router.post('/media/images', singleUpload('file'), mediaController.uploadImage);
router.post('/media/videos', singleVideoUpload('file'), mediaController.uploadVideo);

// --- Services --------------------------------------------------------------
router.post(
  '/services',
  may(AdminResource.SERVICES, CREATE),
  validate({ body: createServiceSchema }),
  serviceController.createService,
);
router.post(
  '/services/reorder',
  may(AdminResource.SERVICES, EDIT),
  validate({ body: reorderSchema }),
  serviceController.reorderServices,
);
router.patch(
  '/services/:id',
  may(AdminResource.SERVICES, EDIT),
  validate({ params: idParamSchema, body: updateServiceSchema }),
  serviceController.updateService,
);
router.delete(
  '/services/:id',
  may(AdminResource.SERVICES, DELETE),
  validate({ params: idParamSchema }),
  serviceController.deleteService,
);

// --- Availability ----------------------------------------------------------
// The admin's own slot list: same engine as the public one, minus the
// minimum-notice window the lounge is allowed to book inside.
//
// The slot list is gated on APPOINTMENTS rather than AVAILABILITY: it is what
// the booking dialog reads, so an employee who books clients in needs it even
// when they may not touch the opening hours.
router.get(
  '/availability/slots',
  may(AdminResource.APPOINTMENTS, VIEW),
  validate({ query: availabilityQuerySchema }),
  availabilityController.getAdminAvailability,
);
router.get(
  '/availability/working-hours',
  may(AdminResource.AVAILABILITY, VIEW),
  availabilityController.listWorkingHours,
);
router.put(
  '/availability/working-hours',
  may(AdminResource.AVAILABILITY, EDIT),
  validate({ body: updateWorkingHoursSchema }),
  availabilityController.updateWorkingHours,
);
router.get(
  '/availability/blocked',
  may(AdminResource.AVAILABILITY, VIEW),
  validate({ query: listBlockedPeriodsQuerySchema }),
  availabilityController.listBlockedPeriods,
);
router.post(
  '/availability/blocked',
  may(AdminResource.AVAILABILITY, CREATE),
  validate({ body: createBlockedPeriodSchema }),
  availabilityController.createBlockedPeriod,
);
router.delete(
  '/availability/blocked/:id',
  may(AdminResource.AVAILABILITY, DELETE),
  validate({ params: idParamSchema }),
  availabilityController.deleteBlockedPeriod,
);

// --- Gallery ---------------------------------------------------------------
router.post(
  '/gallery',
  may(AdminResource.GALLERY, CREATE),
  validate({ body: createGalleryImageSchema }),
  galleryController.createGalleryImage,
);
router.post(
  '/gallery/reorder',
  may(AdminResource.GALLERY, EDIT),
  validate({ body: reorderSchema }),
  galleryController.reorderGallery,
);
router.patch(
  '/gallery/:id',
  may(AdminResource.GALLERY, EDIT),
  validate({ params: idParamSchema, body: updateGalleryImageSchema }),
  galleryController.updateGalleryImage,
);
router.delete(
  '/gallery/:id',
  may(AdminResource.GALLERY, DELETE),
  validate({ params: idParamSchema }),
  galleryController.deleteGalleryImage,
);

// --- Instagram reels -------------------------------------------------------
router.get(
  '/instagram/reels',
  may(AdminResource.INSTAGRAM, VIEW),
  instagramController.listReels,
);
// Reaches out to Instagram, so it is a POST rather than a GET: it is not
// cacheable and it stores the cover it downloads. That download is why it needs
// CREATE rather than VIEW.
router.post(
  '/instagram/reels/lookup',
  may(AdminResource.INSTAGRAM, CREATE),
  validate({ body: lookupReelSchema }),
  instagramController.lookupReel,
);
router.post(
  '/instagram/reels',
  may(AdminResource.INSTAGRAM, CREATE),
  validate({ body: createReelSchema }),
  instagramController.createReel,
);
router.post(
  '/instagram/reels/reorder',
  may(AdminResource.INSTAGRAM, EDIT),
  validate({ body: reorderSchema }),
  instagramController.reorderReels,
);
router.patch(
  '/instagram/reels/:id',
  may(AdminResource.INSTAGRAM, EDIT),
  validate({ params: idParamSchema, body: updateReelSchema }),
  instagramController.updateReel,
);
router.delete(
  '/instagram/reels/:id',
  may(AdminResource.INSTAGRAM, DELETE),
  validate({ params: idParamSchema }),
  instagramController.deleteReel,
);

// --- Staff -----------------------------------------------------------------
/**
 * Owner-only, and not a grantable resource.
 *
 * Anyone who can edit staff can grant themselves everything else, so this is
 * the one section that cannot be delegated — otherwise the permission system
 * would be a lock whose key is kept beside it.
 */
router.get('/staff', requireOwner, staffController.listStaff);
router.post(
  '/staff',
  requireOwner,
  validate({ body: createStaffSchema }),
  staffController.createStaff,
);
router.get(
  '/staff/:id',
  requireOwner,
  validate({ params: idParamSchema }),
  staffController.getStaff,
);
router.patch(
  '/staff/:id',
  requireOwner,
  validate({ params: idParamSchema, body: updateStaffSchema }),
  staffController.updateStaff,
);
router.delete(
  '/staff/:id',
  requireOwner,
  validate({ params: idParamSchema }),
  staffController.deleteStaff,
);

export default router;
