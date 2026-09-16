import { Router } from "express";
import { ReportsController } from "./controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { Role } from "@prisma/client";

const router = Router();

router.use(requireAuth);
router.use(requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER));

router.get("/sales", ReportsController.getSalesReport);
router.get("/inventory", ReportsController.getInventoryReport);
router.get("/stock-adjustments", ReportsController.getStockAdjustmentsReport);
router.get("/cash-handover", ReportsController.getCashHandoverReport);
router.get("/due-list", ReportsController.getDueList);
router.get("/warehouse-stock", ReportsController.getWarehouseStock);
router.get("/daily-sales", ReportsController.getDailySalesStatement);
router.get("/daily-purchases", ReportsController.getDailyPurchases);
router.get("/daily-costs", ReportsController.getDailyCosts);
router.get("/daily-purchase-sales", ReportsController.getDailyPurchaseOrSales);
router.get("/bi-analytics", ReportsController.getBIAnalytics);
router.get("/mom-comparison", ReportsController.getMoMComparison);
router.get("/product-velocity", ReportsController.getProductVelocity);
router.get("/customer-ledger/:customerId?", ReportsController.getCustomerLedger);
router.get("/user-performance", ReportsController.getUserPerformance);
router.get("/reorder-alerts", ReportsController.getReorderAlerts);
router.get("/stock-aging", ReportsController.getStockAging);

// Commercial Profit & Executive Reports strictly for Super Admin and Admin
router.get(
  "/profit-by-invoice/:invoiceNumber?",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN),
  ReportsController.getProfitByInvoice,
);
router.get(
  "/balance-sheet",
  requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  ReportsController.getBalanceSheet,
);

export default router;
