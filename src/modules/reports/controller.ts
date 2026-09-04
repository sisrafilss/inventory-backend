import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { SaleStatus, StockMovementType } from '@prisma/client';

export class ReportsController {
  static async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { report, meta } = await ReportsService.getSalesReport({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        salesOfficerId: req.query.salesOfficerId as string,
        status: req.query.status as SaleStatus,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });
      return sendSuccess(res, report, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportsService.getInventoryReport({
        categoryId: req.query.categoryId as string,
        stockStatus: req.query.stockStatus as 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      });
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  static async getStockAdjustmentsReport(req: Request, res: Response, next: NextFunction) {
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

  static async getSalesOfficersReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportsService.getSalesOfficersReport({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  static async getCashHandoverReport(req: Request, res: Response, next: NextFunction) {
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
}
