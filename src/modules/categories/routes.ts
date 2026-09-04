import { Router } from 'express';
import { CategoriesController } from './controller.js';
import { requireAuth, requireRoles } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { createCategorySchema, updateCategorySchema, listCategoriesSchema } from './schema.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(requireAuth);

// All authenticated users can view categories (for sales entry or product management)
router.get('/', validateRequest(listCategoriesSchema), CategoriesController.listCategories);
router.get('/:id', CategoriesController.getCategoryById);

// Only Super Admin, Admin, Manager can create/update categories
router.post(
  '/',
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createCategorySchema),
  CategoriesController.createCategory
);

router.patch(
  '/:id',
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(updateCategorySchema),
  CategoriesController.updateCategory
);

export default router;
