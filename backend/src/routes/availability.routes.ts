import { Router } from 'express';
import * as controller from '../controllers/availability.controller';
import { validate } from '../middleware/validate';
import {
  availabilityOverviewQuerySchema,
  availabilityQuerySchema,
} from '../validators/availability.validators';

const router = Router();

router.get('/', validate({ query: availabilityQuerySchema }), controller.getAvailability);
router.get(
  '/overview',
  validate({ query: availabilityOverviewQuerySchema }),
  controller.getOverview,
);
router.get('/settings', controller.getBookingSettings);

export default router;
