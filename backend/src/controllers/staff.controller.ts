import type { Request, Response } from 'express';
import * as staffService from '../services/staff.service';
import { ADMIN_RESOURCES, PERMISSION_ACTIONS, READ_ONLY_RESOURCES } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';

/**
 * The permission vocabulary travels with the list so the admin renders its grid
 * from the server's definition. Adding a section server-side then shows up in
 * the UI without a matching frontend edit that could drift out of step.
 */
const PERMISSION_SCHEMA = {
  resources: ADMIN_RESOURCES,
  actions: PERMISSION_ACTIONS,
  readOnlyResources: READ_ONLY_RESOURCES,
};

export const listStaff = asyncHandler(async (_req: Request, res: Response) => {
  const staff = await staffService.listStaff();
  ok(res, { staff, permissionSchema: PERMISSION_SCHEMA });
});

export const getStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.getStaff(req.params.id as string);
  ok(res, { staff });
});

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.createStaff(req.body);
  ok(res, { staff: staff.toJSON(), message: `${staff.fullName} can now sign in.` }, 201);
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const staff = await staffService.updateStaff(req.params.id as string, req.body, req.user._id);
  ok(res, { staff: staff.toJSON(), message: 'Team member updated.' });
});

export const deleteStaff = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await staffService.deleteStaff(req.params.id as string, req.user._id);
  ok(res, { message: 'Team member removed.' });
});
