import { Router } from 'express';
import * as clientAssetController from '../controllers/clientAsset.controller';
import { validate } from '../middleware/validate';
import {
  signedVariantParamsSchema,
  signedVariantQuerySchema,
} from '../validators/clientAsset.validators';

const router = Router();

/**
 * Client photographs, by signed URL. No bearer token: the signature in the
 * query string is the credential, which is what lets a plain `<img>` load
 * these. See `services/assetUrl.service.ts`.
 */
router.get(
  '/:assetId/:variant',
  validate({ params: signedVariantParamsSchema, query: signedVariantQuerySchema }),
  clientAssetController.streamVariant,
);

export default router;
