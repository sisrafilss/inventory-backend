import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { Role } from "@prisma/client";

export interface JwtPayload {
  userId: string;
  role: Role;
  username?: string;
  email?: string | null;
}

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
};
