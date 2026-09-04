import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret:
    process.env.JWT_SECRET || "fallback-secret-for-dev-change-in-prod-min-32",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};

if (!config.jwtSecret || config.jwtSecret.length < 16) {
  console.warn(
    "Warning: JWT_SECRET should be a secure key of at least 32 characters in production.",
  );
}
