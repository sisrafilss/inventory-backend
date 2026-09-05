import { Request, Response, NextFunction } from "express";
import { PurchasesService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class PurchasesController {
  static async createPurchase(req: Request, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchasesService.createPurchase(req.user!.id, req.body);
      return sendSuccess(res, purchase, "Purchase logged and inventory updated successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async listPurchases(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const { purchases, meta } = await PurchasesService.listPurchases({
        page,
        limit,
        supplierId: req.query.supplierId as string,
        paymentType: req.query.paymentType as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
      });
      return sendSuccess(res, purchases, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getPurchaseById(req: Request, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchasesService.getPurchaseById(req.params.id);
      return sendSuccess(res, purchase);
    } catch (error) {
      next(error);
    }
  }
}
