import { Router } from "express";
import { SettingsController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { updateStoreSettingSchema } from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

router.get("/store", SettingsController.getStoreSetting);

router.put(
  "/store",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(updateStoreSettingSchema),
  SettingsController.updateStoreSetting,
);

export default router;
