import { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: any;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: PaginationMeta,
) => {
  return res.status(statusCode).json({
    success: true,
    ...(message ? { message } : {}),
    data,
    ...(meta ? { meta } : {}),
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  code = "ERROR",
  errors?: Record<string, string>,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(errors ? { errors } : {}),
  });
};
