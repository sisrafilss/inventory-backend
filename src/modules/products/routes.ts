import { Router } from "express";
import { ProductsController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  updateSaleRateSchema,
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
router.get("/by-code/:code", ProductsController.getProductByCode);
router.get("/:id", ProductsController.getProductById);

// Only Super Admin, Admin, Manager can create/update products & rates
router.post(
  "/",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createProductSchema),
  ProductsController.createProduct,
);

router.post(
  "/sale-rate",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(updateSaleRateSchema),
  ProductsController.updateSaleRate,
);

router.patch(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(updateProductSchema),
  ProductsController.updateProduct,
);

export default router;
