import { Router } from "express";
import { PartiesController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createSupplierSchema,
  updateSupplierSchema,
  createCustomerSchema,
  updateCustomerSchema,
  listPartiesSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

// Summary
router.get("/summary", PartiesController.getDuesSummary);

// Suppliers
router.get(
  "/suppliers",
  validateRequest(listPartiesSchema),
  PartiesController.listSuppliers,
);
router.get("/suppliers/:id", PartiesController.getSupplierById);
router.post(
  "/suppliers",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createSupplierSchema),
  PartiesController.createSupplier,
);
router.patch(
  "/suppliers/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(updateSupplierSchema),
  PartiesController.updateSupplier,
);
router.delete(
  "/suppliers/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  PartiesController.deleteSupplier,
);

// Customers
router.get(
  "/customers",
  validateRequest(listPartiesSchema),
  PartiesController.listCustomers,
);
router.get("/customers/:id", PartiesController.getCustomerById);
router.post(
  "/customers",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createCustomerSchema),
  PartiesController.createCustomer,
);
router.patch(
  "/customers/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(updateCustomerSchema),
  PartiesController.updateCustomer,
);
router.delete(
  "/customers/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  PartiesController.deleteCustomer,
);

export default router;
