import { Request, Response, NextFunction } from "express";
import { SalesService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { SaleStatus } from "@prisma/client";

export class SalesController {
  static async createSale(req: Request, res: Response, next: NextFunction) {
    try {
      const sale = await SalesService.createSale(req.user!.id, req.body);
      return sendSuccess(
        res,
        sale,
        "Sale created and inventory deducted successfully.",
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  static async listSales(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;
      const status = req.query.status as SaleStatus;
      const createdById = req.query.createdById as string;
      const customerId = req.query.customerId as string;
      const search = req.query.search as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const { sales, meta } = await SalesService.listSales(
        { id: req.user!.id, role: req.user!.role },
        { page, limit, status, createdById, customerId, search, startDate, endDate },
      );

      return sendSuccess(res, sales, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getSaleById(req: Request, res: Response, next: NextFunction) {
    try {
      const sale = await SalesService.getSaleById(
        { id: req.user!.id, role: req.user!.role },
        req.params.id,
      );
      return sendSuccess(res, sale);
    } catch (error) {
      next(error);
    }
  }
}
