import { Request, Response, NextFunction } from "express";
import { ReturnsService } from "./service.js";

export class ReturnsController {
  // Sales Returns
  static async createSalesReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await ReturnsService.createSalesReturn({
        ...req.body,
        userId,
      });

      res.status(201).json({
        status: "success",
        message: "Sales return processed successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listSalesReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.listSalesReturns(req.query as any);
      res.status(200).json({
        status: "success",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSalesReturnById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.getSalesReturnById(req.params.id);
      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Purchase Returns
  static async createPurchaseReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await ReturnsService.createPurchaseReturn({
        ...req.body,
        userId,
      });

      res.status(201).json({
        status: "success",
        message: "Purchase return processed successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listPurchaseReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.listPurchaseReturns(req.query as any);
      res.status(200).json({
        status: "success",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPurchaseReturnById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.getPurchaseReturnById(req.params.id);
      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
