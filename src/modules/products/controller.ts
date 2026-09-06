import { Request, Response, NextFunction } from "express";
import { ProductsService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class ProductsController {
  static async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;
      const search = req.query.search as string;
      const categoryId = req.query.categoryId as string;
      const isActive =
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined;
      const stockStatus = req.query.stockStatus as
        | "ALL"
        | "IN_STOCK"
        | "LOW_STOCK"
        | "OUT_OF_STOCK";

      const { products, meta } = await ProductsService.listProducts({
        page,
        limit,
        search,
        categoryId,
        isActive,
        stockStatus,
      });

      return sendSuccess(res, products, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductsService.getProductById(req.params.id);
      return sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductsService.createProduct(
        req.user!.id,
        req.body,
      );
      return sendSuccess(res, product, "Product created successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductsService.updateProduct(
        req.user!.id,
        req.params.id,
        req.body,
      );
      return sendSuccess(res, product, "Product updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  static async getProductByCode(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const product = await ProductsService.getProductByCode(req.params.code);
      return sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }

  static async updateSaleRate(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductsService.updateSaleRate(
        req.user!.id,
        req.body,
      );
      return sendSuccess(res, product, "Sale rate updated successfully.");
    } catch (error) {
      next(error);
    }
  }
}
