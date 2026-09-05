import { Router } from "express";
import { ExpensesController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
} from "./schema.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listExpensesSchema),
  ExpensesController.listExpenses,
);
router.get("/:id", ExpensesController.getExpenseById);

router.post(
  "/",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  validateRequest(createExpenseSchema),
  ExpensesController.createExpense,
);

router.patch(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(updateExpenseSchema),
  ExpensesController.updateExpense,
);

router.delete(
  "/:id",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  ExpensesController.deleteExpense,
);

export default router;
