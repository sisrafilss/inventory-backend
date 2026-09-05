import { Router } from "express";
import { SalesController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createSaleSchema,
  listSalesSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

// List sales
router.get("/", validateRequest(listSalesSchema), SalesController.listSales);
router.get("/:id", SalesController.getSaleById);

// Create sale: Super Admin, Admin, Manager (direct execution)
router.post(
  "/",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createSaleSchema),
  SalesController.createSale,
);

export default router;
