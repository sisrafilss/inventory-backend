import { Router } from "express";
import { AuthController } from "./controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { loginSchema, changePasswordSchema } from "./schema.js";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

router.post("/login", validateRequest(loginSchema), AuthController.login);

router.post(
  "/change-password",
  requireAuth,
  validateRequest(changePasswordSchema),
  AuthController.changePassword,
);

router.get("/me", requireAuth, AuthController.getMe);

export default router;
