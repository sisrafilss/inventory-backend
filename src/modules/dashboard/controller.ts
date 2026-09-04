import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class DashboardController {
  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await DashboardService.getSummary({
        id: req.user!.id,
        role: req.user!.role,
      });
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
}
