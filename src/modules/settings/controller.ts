import { Request, Response, NextFunction } from "express";
import { SettingsService } from "./service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export class SettingsController {
  static async getStoreSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const setting = await SettingsService.getStoreSetting();
      return sendSuccess(res, setting);
    } catch (error) {
      next(error);
    }
  }

  static async updateStoreSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const setting = await SettingsService.updateStoreSetting(req.body);
      return sendSuccess(res, setting, "Store settings updated successfully.");
    } catch (error) {
      next(error);
    }
  }
}
