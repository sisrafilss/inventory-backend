import { Request, Response, NextFunction } from "express";
import { PaymentsService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class PaymentsController {
  static async collectFromCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentsService.collectFromCustomer(req.user!.id, req.body);
      return sendSuccess(res, payment, "Payment collection recorded successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async payToSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentsService.payToSupplier(req.user!.id, req.body);
      return sendSuccess(res, payment, "Supplier payment recorded successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await PaymentsService.listPayments({
        page,
        limit,
        type: req.query.type as string,
        customerId: req.query.customerId as string,
        supplierId: req.query.supplierId as string,
        paymentMethod: req.query.paymentMethod as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });
      return sendSuccess(res, result.payments, undefined, 200, {
        ...result.meta,
        totalAmount: result.totalAmount,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentsService.getPaymentById(req.params.id);
      return sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  }
}
