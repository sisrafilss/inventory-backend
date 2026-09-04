import { Request, Response, NextFunction } from 'express';
import { AuditService } from './service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class AuditController {
  static async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const actorId = req.query.actorId as string;
      const action = req.query.action as string;
      const entityType = req.query.entityType as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const { logs, meta } = await AuditService.listAuditLogs({
        page,
        limit,
        actorId,
        action,
        entityType,
        startDate,
        endDate,
      });

      return sendSuccess(res, logs, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }
}
