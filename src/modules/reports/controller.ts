import { Request, Response, NextFunction } from "express";
import { ReportsService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { SaleStatus, StockMovementType } from "@prisma/client";

export class ReportsController {
  static async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { report, meta } = await ReportsService.getSalesReport({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        createdById: req.query.createdById as string,
        status: req.query.status as SaleStatus,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });
      return sendSuccess(res, report, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getInventoryReport(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const report = await ReportsService.getInventoryReport({
        categoryId: req.query.categoryId as string,
        stockStatus: req.query.stockStatus as
          | "ALL"
          | "IN_STOCK"
          | "LOW_STOCK"
          | "OUT_OF_STOCK",
        isActive:
          req.query.isActive !== undefined
            ? req.query.isActive === "true"
            : undefined,
      });
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  static async getStockAdjustmentsReport(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { report, meta } = await ReportsService.getStockAdjustmentsReport({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        productId: req.query.productId as string,
        type: req.query.type as StockMovementType,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });
      return sendSuccess(res, report, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getCashHandoverReport(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { report, meta } = await ReportsService.getCashHandoverReport({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });
      return sendSuccess(res, report, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getDueList(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportsService.getDueList({
        type: req.query.type as "ALL" | "CUSTOMER" | "SUPPLIER",
        search: req.query.search as string,
      });
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  static async getProfitByInvoice(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const invoiceNumber = req.params.invoiceNumber || (req.query.invoiceNumber as string);
      const report = await ReportsService.getProfitByInvoice(
        invoiceNumber,
        req.user!.role,
      );
      return sendSuccess(res, report);
    } catch (error: any) {
      if (error.message === "FORBIDDEN_PROFIT_ACCESS") {
        return res
          .status(403)
          .json({ success: false, message: "Forbidden: Only Admin and Super Admin can view profit data." });
      }
      if (error.message === "INVOICE_NOT_FOUND") {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found." });
      }
      next(error);
    }
  }

  static async getWarehouseStock(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const report = await ReportsService.getWarehouseStock({
        warehouseId: req.query.warehouseId as string,
        companyId: req.query.companyId as string,
      });
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  static async getDailySalesStatement(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const report = await ReportsService.getDailySalesStatement(
        {
          date: req.query.date as string,
          warehouseId: req.query.warehouseId as string,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        },
        req.user!.role,
      );
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  static async getDailyPurchases(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const report = await ReportsService.getDailyPurchases({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        supplierId: req.query.supplierId as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  static async getDailyCosts(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportsService.getDailyCosts({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        category: req.query.category as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  static async getBalanceSheet(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const report = await ReportsService.getBalanceSheet(
        {
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
        },
        req.user!.role,
      );
      return sendSuccess(res, report);
    } catch (error: any) {
      if (error.message === "FORBIDDEN_BALANCE_SHEET") {
        return res
          .status(403)
          .json({ success: false, message: "Forbidden: Only Admin and Super Admin can view Balance Sheet." });
      }
      next(error);
    }
  }
}
