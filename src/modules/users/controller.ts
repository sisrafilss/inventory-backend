import { Request, Response, NextFunction } from "express";
import { UsersService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { Role, UserStatus } from "@prisma/client";

export class UsersController {
  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;
      const search = req.query.search as string;
      const role = req.query.role as Role;
      const status = req.query.status as UserStatus;

      const { users, meta } = await UsersService.listUsers({
        page,
        limit,
        search,
        role,
        status,
      });
      return sendSuccess(res, users, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.getUserById(req.params.id);
      return sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.createUser(
        { id: req.user!.id, role: req.user!.role },
        req.body,
      );
      return sendSuccess(res, user, "User created successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.updateUser(
        req.user!.id,
        req.params.id,
        req.body,
      );
      return sendSuccess(res, user, "User updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  static async verifySalesOfficer(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = await UsersService.verifySalesOfficer(
        req.user!.id,
        req.params.id,
      );
      return sendSuccess(
        res,
        user,
        "Sales Officer verified and activated successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  static async rejectSalesOfficer(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = await UsersService.rejectSalesOfficer(
        req.user!.id,
        req.params.id,
        req.body.reason,
      );
      return sendSuccess(res, user, "Sales Officer registration rejected.");
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.updateUserStatus(
        { id: req.user!.id, role: req.user!.role },
        req.params.id,
        req.body.status,
      );
      return sendSuccess(res, user, "User status updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UsersService.resetPassword(
        { id: req.user!.id, role: req.user!.role },
        req.params.id,
        req.body.newPassword,
      );
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}
