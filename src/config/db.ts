import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Always store on globalThis to prevent opening redundant connection pools in serverless warm containers
globalForPrisma.prisma = prisma;
