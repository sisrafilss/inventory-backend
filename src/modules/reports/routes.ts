import { Router } from 'express';
import { ReportsController } from './controller.js';
import { requireAuth, requireRoles } from '../../middlewares/auth.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(requireAuth);
router.use(requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER));

router.get('/sales', ReportsController.getSalesReport);
router.get('/inventory', ReportsController.getInventoryReport);
router.get('/stock-adjustments', ReportsController.getStockAdjustmentsReport);
router.get('/sales-officers', ReportsController.getSalesOfficersReport);
router.get('/cash-handover', ReportsController.getCashHandoverReport);

export default router;
