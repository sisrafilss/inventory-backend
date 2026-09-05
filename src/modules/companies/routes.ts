import { Router } from "express";
import { CompaniesController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createCompanySchema,
  updateCompanySchema,
  listCompaniesSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listCompaniesSchema),
  CompaniesController.listCompanies,
);
router.get("/:id", CompaniesController.getCompanyById);

router.post(
  "/",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createCompanySchema),
  CompaniesController.createCompany,
);

router.patch(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(updateCompanySchema),
  CompaniesController.updateCompany,
);

router.delete(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  CompaniesController.deleteCompany,
);

export default router;
