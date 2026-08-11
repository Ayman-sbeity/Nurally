import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { singleUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validators';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', requireAuth, controller.logout);

router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword,
);

router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, validate({ body: updateProfileSchema }), controller.updateProfile);
router.post('/me/avatar', requireAuth, singleUpload('avatar'), controller.uploadAvatar);
router.delete('/me/avatar', requireAuth, controller.deleteAvatar);

router.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);

export default router;
