import { Request, Response, NextFunction } from "express";
import { ExpensesService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class ExpensesController {
  static async listExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await ExpensesService.listExpenses({
        page,
        limit,
        category: req.query.category as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
      });
      return sendSuccess(res, result.expenses, undefined, 200, {
        ...result.meta,
        totalAmount: result.totalAmount,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExpenseById(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await ExpensesService.getExpenseById(req.params.id);
      return sendSuccess(res, expense);
    } catch (error) {
      next(error);
    }
  }

  static async createExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await ExpensesService.createExpense(req.user!.id, req.body);
      return sendSuccess(res, expense, "Expense recorded successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await ExpensesService.updateExpense(
        req.user!.id,
        req.params.id,
        req.body,
      );
      return sendSuccess(res, expense, "Expense updated successfully");
    } catch (error) {
      next(error);
    }
  }

  static async deleteExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ExpensesService.deleteExpense(req.user!.id, req.params.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
