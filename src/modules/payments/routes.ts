import { Router } from "express";
import { PaymentsController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  collectFromCustomerSchema,
  payToSupplierSchema,
  listPaymentsSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listPaymentsSchema),
  PaymentsController.listPayments,
);
router.get("/:id", PaymentsController.getPaymentById);

router.post(
  "/collect",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(collectFromCustomerSchema),
  PaymentsController.collectFromCustomer,
);

router.post(
  "/pay",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(payToSupplierSchema),
  PaymentsController.payToSupplier,
);

export default router;
