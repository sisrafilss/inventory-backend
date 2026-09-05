import { Router } from "express";
import { WarehousesController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  listWarehousesSchema,
  transferStockSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listWarehousesSchema),
  WarehousesController.listWarehouses,
);
router.get("/:id", WarehousesController.getWarehouseById);

router.post(
  "/",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(createWarehouseSchema),
  WarehousesController.createWarehouse,
);

router.patch(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(updateWarehouseSchema),
  WarehousesController.updateWarehouse,
);

router.post(
  "/transfer",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(transferStockSchema),
  WarehousesController.transferStock,
);

export default router;
