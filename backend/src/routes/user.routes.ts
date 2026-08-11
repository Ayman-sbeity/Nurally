import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../validators/appointment.validators';

const router = Router();

/**
 * Profile photos. Authenticated, and authorised inside the controller: the
 * owner or an admin, nobody else. It sits here rather than under /auth because
 * it addresses *a* user rather than the caller.
 */
router.get(
  '/:id/avatar',
  requireAuth,
  validate({ params: idParamSchema }),
  authController.streamAvatar,
);

export default router;
