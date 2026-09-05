import { Request, Response, NextFunction } from "express";
import { CompaniesService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class CompaniesController {
  static async listCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive =
        req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const companies = await CompaniesService.listCompanies({
        search: req.query.search as string,
        isActive,
      });
      return sendSuccess(res, companies);
    } catch (error) {
      next(error);
    }
  }

  static async getCompanyById(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await CompaniesService.getCompanyById(req.params.id);
      return sendSuccess(res, company);
    } catch (error) {
      next(error);
    }
  }

  static async createCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await CompaniesService.createCompany(req.user!.id, req.body);
      return sendSuccess(res, company, "Company created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await CompaniesService.updateCompany(
        req.user!.id,
        req.params.id,
        req.body,
      );
      return sendSuccess(res, company, "Company updated successfully");
    } catch (error) {
      next(error);
    }
  }

  static async deleteCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CompaniesService.deleteCompany(req.user!.id, req.params.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
