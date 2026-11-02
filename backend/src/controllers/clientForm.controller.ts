import type { Request, Response } from 'express';
import * as assetService from '../services/clientAsset.service';
import * as formService from '../services/clientForm.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';

/** Every form for a client, newest first, without signature images. */
export const listForms = asyncHandler(async (req: Request, res: Response) => {
  const clientId = await assetService.assertClientExists(req.params.id as string);
  ok(res, { forms: await formService.listForms(clientId) });
});

export const getForm = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { form: await formService.getForm(req.params.formId as string) });
});

export const createForm = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await formService.createForm({
    clientId: req.params.id as string,
    ...req.body,
    actorId: req.user._id,
  });
  ok(res, { form }, 201);
});

export const updateForm = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await formService.updateForm(req.params.formId as string, {
    ...req.body,
    actorId: req.user._id,
  });
  ok(res, { form });
});

export const deleteForm = asyncHandler(async (req: Request, res: Response) => {
  await formService.deleteForm(req.params.formId as string);
  ok(res, { deleted: true });
});
