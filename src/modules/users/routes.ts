import { Router } from 'express';
import { UsersController } from './controller.js';
import { requireAuth, requireRoles } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import {
  createUserSchema,
  updateUserSchema,
  verifyUserSchema,
  rejectUserSchema,
  updateStatusSchema,
  resetPasswordSchema,
  listUsersSchema,
} from './schema.js';
import { Role } from '@prisma/client';

const router = Router();

// All user management routes require auth and at least Admin or Super Admin
router.use(requireAuth);
router.use(requireRoles(Role.SUPER_ADMIN, Role.ADMIN));

router.get(
  '/',
  validateRequest(listUsersSchema),
  UsersController.listUsers
);

router.post(
  '/',
  validateRequest(createUserSchema),
  UsersController.createUser
);

router.get(
  '/:id',
  UsersController.getUserById
);

router.patch(
  '/:id',
  validateRequest(updateUserSchema),
  UsersController.updateUser
);

router.post(
  '/:id/verify',
  validateRequest(verifyUserSchema),
  UsersController.verifySalesOfficer
);

router.post(
  '/:id/reject',
  validateRequest(rejectUserSchema),
  UsersController.rejectSalesOfficer
);

router.patch(
  '/:id/status',
  validateRequest(updateStatusSchema),
  UsersController.updateStatus
);

router.post(
  '/:id/reset-password',
  validateRequest(resetPasswordSchema),
  UsersController.resetPassword
);

export default router;
