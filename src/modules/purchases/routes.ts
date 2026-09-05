import { Router } from "express";
import { PurchasesController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { createPurchaseSchema, listPurchasesSchema } from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listPurchasesSchema),
  PurchasesController.listPurchases,
);
router.get("/:id", PurchasesController.getPurchaseById);

router.post(
  "/",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createPurchaseSchema),
  PurchasesController.createPurchase,
);

export default router;
