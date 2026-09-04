import { Router } from "express";
import { ProductsController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

// All authenticated users can view products
router.get(
  "/",
  validateRequest(listProductsSchema),
  ProductsController.listProducts,
);
router.get("/:id", ProductsController.getProductById);

// Only Super Admin, Admin, Manager can create/update products
router.post(
  "/",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createProductSchema),
  ProductsController.createProduct,
);

router.patch(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(updateProductSchema),
  ProductsController.updateProduct,
);

export default router;
