import { Router } from 'express';
import { DashboardController } from './controller.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/summary', DashboardController.getSummary);

export default router;
