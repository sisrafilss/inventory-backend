import { Router } from 'express';
import { AuditController } from './controller.js';
import { requireAuth, requireRoles } from '../../middlewares/auth.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(requireAuth);
// Audit logs are sensitive and accessible only to Super Admin and Admin
router.use(requireRoles(Role.SUPER_ADMIN, Role.ADMIN));

router.get('/', AuditController.listAuditLogs);

export default router;
