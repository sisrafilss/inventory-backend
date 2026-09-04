import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { config } from "../config/env.js";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  console.error("Unhandled server error:", err);

  const message =
    config.nodeEnv === "production"
      ? "Internal server error occurred."
      : err.message;
  return res.status(500).json({
    success: false,
    message,
    code: "INTERNAL_SERVER_ERROR",
  });
};
