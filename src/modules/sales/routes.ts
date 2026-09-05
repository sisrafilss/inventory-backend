import { Router } from "express";
import { SalesController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createSaleSchema,
  rejectSaleSchema,
  listSalesSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

// List sales
router.get("/", validateRequest(listSalesSchema), SalesController.listSales);
router.get("/:id", SalesController.getSaleById);

// Create sale: Super Admin, Admin, Manager
router.post(
  "/",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createSaleSchema),
  SalesController.createSale,
);

// Approve sale: ONLY Super Admin, Admin, Manager
router.post(
  "/:id/approve",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  SalesController.approveSale,
);

// Reject sale: ONLY Super Admin, Admin, Manager
router.post(
  "/:id/reject",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(rejectSaleSchema),
  SalesController.rejectSale,
);

export default router;
