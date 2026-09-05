import { Request, Response, NextFunction } from "express";
import { PartiesService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class PartiesController {
  // Suppliers
  static async listSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive =
        req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const hasDue = req.query.hasDue === "true";
      const suppliers = await PartiesService.listSuppliers({
        search: req.query.search as string,
        isActive,
        hasDue,
      });
      return sendSuccess(res, suppliers);
    } catch (error) {
      next(error);
    }
  }

  static async getSupplierById(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await PartiesService.getSupplierById(req.params.id);
      return sendSuccess(res, supplier);
    } catch (error) {
      next(error);
    }
  }

  static async createSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await PartiesService.createSupplier(req.user!.id, req.body);
      return sendSuccess(res, supplier, "Supplier created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await PartiesService.updateSupplier(
        req.user!.id,
        req.params.id,
        req.body,
      );
      return sendSuccess(res, supplier, "Supplier updated successfully");
    } catch (error) {
      next(error);
    }
  }

  static async deleteSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PartiesService.deleteSupplier(req.user!.id, req.params.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Customers
  static async listCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive =
        req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const hasDue = req.query.hasDue === "true";
      const customers = await PartiesService.listCustomers({
        search: req.query.search as string,
        isActive,
        hasDue,
      });
      return sendSuccess(res, customers);
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerById(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await PartiesService.getCustomerById(req.params.id);
      return sendSuccess(res, customer);
    } catch (error) {
      next(error);
    }
  }

  static async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await PartiesService.createCustomer(req.user!.id, req.body);
      return sendSuccess(res, customer, "Customer created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await PartiesService.updateCustomer(
        req.user!.id,
        req.params.id,
        req.body,
      );
      return sendSuccess(res, customer, "Customer updated successfully");
    } catch (error) {
      next(error);
    }
  }

  static async deleteCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PartiesService.deleteCustomer(req.user!.id, req.params.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Summary
  static async getDuesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await PartiesService.getDuesSummary();
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
}
