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
router.get(
  "/by-transaction/:transactionId",
  PaymentsController.getByTransaction,
);
router.get("/:id", PaymentsController.getPaymentById);

// Customer Collection (supports /collect and /customer-collection)
router.post(
  "/collect",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(collectFromCustomerSchema),
  PaymentsController.collectFromCustomer,
);
router.post(
  "/customer-collection",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(collectFromCustomerSchema),
  PaymentsController.collectFromCustomer,
);

// Supplier Payment (supports /pay and /supplier-payment)
router.post(
  "/pay",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(payToSupplierSchema),
  PaymentsController.payToSupplier,
);
router.post(
  "/supplier-payment",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(payToSupplierSchema),
  PaymentsController.payToSupplier,
);

// Update and Delete payment
router.put(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  PaymentsController.updatePayment,
);
router.patch(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  PaymentsController.updatePayment,
);
router.delete(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  PaymentsController.deletePayment,
);

export default router;
