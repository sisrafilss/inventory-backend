import { Router } from 'express';
import { InventoryController } from './controller.js';
import { requireAuth, requireRoles } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { createAdjustmentSchema, listMovementsSchema } from './schema.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(requireAuth);

// Overview available to all authenticated roles (with appropriate fields)
router.get('/overview', InventoryController.getOverview);

// History available to Super Admin, Admin, Manager
router.get(
  '/history',
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(listMovementsSchema),
  InventoryController.listStockMovements
);

// Stock adjustments ONLY allowed for Super Admin, Admin, Manager (NOT Sales Officers)
router.post(
  '/adjustments',
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createAdjustmentSchema),
  InventoryController.adjustStock
);

export default router;
