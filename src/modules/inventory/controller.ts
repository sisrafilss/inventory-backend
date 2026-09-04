import { Request, Response, NextFunction } from "express";
import { InventoryService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { StockMovementType } from "@prisma/client";

export class InventoryController {
  static async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.adjustStock(req.user!.id, req.body);
      return sendSuccess(
        res,
        result,
        "Stock adjustment completed successfully.",
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  static async listStockMovements(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;
      const productId = req.query.productId as string;
      const performedById = req.query.performedById as string;
      const type = req.query.type as StockMovementType;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const { movements, meta } = await InventoryService.listStockMovements({
        page,
        limit,
        productId,
        performedById,
        type,
        startDate,
        endDate,
      });

      return sendSuccess(res, movements, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await InventoryService.getInventoryOverview();
      return sendSuccess(res, overview);
    } catch (error) {
      next(error);
    }
  }
}
