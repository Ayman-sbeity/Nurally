import { Router } from 'express';
import * as controller from '../controllers/appointment.controller';
import { requireAuth } from '../middleware/auth';
import { bookingLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  createAppointmentSchema,
  idParamSchema,
  listAppointmentsQuerySchema,
  reasonSchema,
  requestRescheduleSchema,
} from '../validators/appointment.validators';

const router = Router();

// Every appointment route requires a signed-in user; ownership is enforced in
// the service layer so a client can never read another client's booking.
router.use(requireAuth);

router.post(
  '/',
  bookingLimiter,
  validate({ body: createAppointmentSchema }),
  controller.createAppointment,
);
router.get('/', validate({ query: listAppointmentsQuerySchema }), controller.listMyAppointments);
router.get('/:id', validate({ params: idParamSchema }), controller.getAppointment);

router.post(
  '/:id/accept-time',
  validate({ params: idParamSchema }),
  controller.acceptOffer,
);
router.post(
  '/:id/decline-time',
  validate({ params: idParamSchema, body: reasonSchema }),
  controller.declineOffer,
);
router.post(
  '/:id/reschedule',
  validate({ params: idParamSchema, body: requestRescheduleSchema }),
  controller.requestReschedule,
);
router.post(
  '/:id/cancel',
  validate({ params: idParamSchema, body: reasonSchema }),
  controller.cancelAppointment,
);

export default router;
