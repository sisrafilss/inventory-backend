import { Request, Response, NextFunction } from "express";
import { WarehousesService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class WarehousesController {
  static async listWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive =
        req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const warehouses = await WarehousesService.listWarehouses({
        search: req.query.search as string,
        isActive,
      });
      return sendSuccess(res, warehouses);
    } catch (error) {
      next(error);
    }
  }

  static async getWarehouseById(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouse = await WarehousesService.getWarehouseById(req.params.id);
      return sendSuccess(res, warehouse);
    } catch (error) {
      next(error);
    }
  }

  static async createWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouse = await WarehousesService.createWarehouse(req.user!.id, req.body);
      return sendSuccess(res, warehouse, "Warehouse created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouse = await WarehousesService.updateWarehouse(
        req.user!.id,
        req.params.id,
        req.body,
      );
      return sendSuccess(res, warehouse, "Warehouse updated successfully");
    } catch (error) {
      next(error);
    }
  }

  static async transferStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await WarehousesService.transferStock(req.user!.id, req.body);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
