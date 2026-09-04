import { Request, Response, NextFunction } from 'express';
import { CategoriesService } from './service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class CategoriesController {
  static async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

      const categories = await CategoriesService.listCategories({ search, isActive });
      return sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoriesService.getCategoryById(req.params.id);
      return sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoriesService.createCategory(req.user!.id, req.body);
      return sendSuccess(res, category, 'Category created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoriesService.updateCategory(req.user!.id, req.params.id, req.body);
      return sendSuccess(res, category, 'Category updated successfully.');
    } catch (error) {
      next(error);
    }
  }
}
