import { Router } from 'express';
import * as controller from '../controllers/service.controller';
import { optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { listServicesQuerySchema } from '../validators/catalogue.validators';

const router = Router();

// Public catalogue. `optionalAuth` lets an admin preview inactive services
// through the same endpoint without a separate route.
router.get('/', optionalAuth, validate({ query: listServicesQuerySchema }), controller.listServices);
router.get('/:id', optionalAuth, controller.getService);

export default router;
