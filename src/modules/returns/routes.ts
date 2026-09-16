import { Router } from "express";
import { ReturnsController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createSalesReturnSchema,
  createPurchaseReturnSchema,
  listReturnsSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

// Sales Returns
router.get(
  "/sales",
  validateRequest(listReturnsSchema),
  ReturnsController.listSalesReturns
);
router.get("/sales/:id", ReturnsController.getSalesReturnById);
router.post(
  "/sales",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createSalesReturnSchema),
  ReturnsController.createSalesReturn
);

// Purchase Returns
router.get(
  "/purchases",
  validateRequest(listReturnsSchema),
  ReturnsController.listPurchaseReturns
);
router.get("/purchases/:id", ReturnsController.getPurchaseReturnById);
router.post(
  "/purchases",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createPurchaseReturnSchema),
  ReturnsController.createPurchaseReturn
);

export default router;
