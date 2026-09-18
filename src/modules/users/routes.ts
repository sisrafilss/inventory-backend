import { Router } from "express";
import { UsersController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  resetPasswordSchema,
  listUsersSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

// Accessible by Super Admin, Admin, and Manager for customer/sales assignment
router.get(
  "/srs",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  UsersController.listSrs,
);

// All other user management routes require auth and at least Admin or Super Admin
router.use(requireRoles(Role.SUPER_ADMIN, Role.ADMIN));

router.get("/", validateRequest(listUsersSchema), UsersController.listUsers);

router.post("/", validateRequest(createUserSchema), UsersController.createUser);

router.get("/:id", UsersController.getUserById);

router.patch(
  "/:id",
  validateRequest(updateUserSchema),
  UsersController.updateUser,
);

router.patch(
  "/:id/status",
  validateRequest(updateStatusSchema),
  UsersController.updateStatus,
);

router.post(
  "/:id/reset-password",
  validateRequest(resetPasswordSchema),
  UsersController.resetPassword,
);

export default router;
