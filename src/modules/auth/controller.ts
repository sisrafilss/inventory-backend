import { Request, Response, NextFunction } from "express";
import { AuthService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);
      return sendSuccess(res, result, "Login successful.");
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.changePassword(req.user!.id, req.body);
      return sendSuccess(res, result, "Password changed successfully.");
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getMe(req.user!.id);
      return sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }
}
