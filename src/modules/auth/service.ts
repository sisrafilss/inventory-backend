import { prisma } from "../../config/db.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { signToken } from "../../utils/jwt.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { UserStatus, Role } from "@prisma/client";

export class AuthService {
  static async login(data: {
    username?: string;
    email?: string;
    password: string;
  }) {
    const identifier = (data.username || data.email || "").toLowerCase().trim();

    if (!identifier) {
      throw new AppError("Username is required.", 400, "VALIDATION_ERROR");
    }

    // Match case-insensitively by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
      include: {
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!user) {
      throw new AppError(
        "Invalid username or password.",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    // SR users are not authorized to log into the web system
    if (user.role === Role.SR) {
      throw new AppError(
        "Sales Representative (SR) accounts are not authorized to log in.",
        403,
        "SR_LOGIN_FORBIDDEN",
      );
    }

    if (!user.passwordHash) {
      throw new AppError(
        "Invalid username or password.",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError(
        "Invalid username or password.",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    if (user.status === UserStatus.PENDING) {
      throw new AppError(
        "Your registration is pending administrator verification. Please contact an admin.",
        403,
        "ACCOUNT_PENDING",
      );
    }

    if (user.status === UserStatus.REJECTED) {
      throw new AppError(
        "Your account registration has been rejected. Please contact an admin.",
        403,
        "ACCOUNT_REJECTED",
      );
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new AppError(
        "Your account is inactive. Please contact an administrator.",
        403,
        "ACCOUNT_INACTIVE",
      );
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signToken({
      userId: user.id,
      role: user.role,
      username: user.username || undefined,
      email: user.email,
    });

    await logAudit({
      actorId: user.id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
    });

    const { passwordHash: _, ...safeUser } = user;
    return {
      token,
      user: safeUser,
    };
  }

  static async changePassword(
    userId: string,
    data: { currentPassword: string; newPassword: string },
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    if (!user.passwordHash) {
      throw new AppError(
        "Account has no password set.",
        400,
        "NO_PASSWORD_SET",
      );
    }

    const isMatch = await comparePassword(
      data.currentPassword,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new AppError(
        "Current password is incorrect.",
        400,
        "INCORRECT_PASSWORD",
      );
    }

    const newHash = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    await logAudit({
      actorId: userId,
      action: "USER_PASSWORD_CHANGED",
      entityType: "User",
      entityId: userId,
    });

    return { message: "Password changed successfully." };
  }

  static async updateProfile(
    userId: string,
    data: {
      name?: string;
      username?: string;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
    },
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    // If username is provided, verify uniqueness
    if (data.username && data.username.trim()) {
      const trimmedUsername = data.username.trim();
      const existing = await prisma.user.findFirst({
        where: {
          username: { equals: trimmedUsername, mode: "insensitive" },
          id: { not: userId },
        },
      });

      if (existing) {
        throw new AppError(
          "This username is already taken.",
          409,
          "USERNAME_EXISTS",
        );
      }
    }

    // If email is provided, verify uniqueness
    if (data.email && data.email.trim()) {
      const trimmedEmail = data.email.toLowerCase().trim();
      const existing = await prisma.user.findFirst({
        where: {
          email: { equals: trimmedEmail, mode: "insensitive" },
          id: { not: userId },
        },
      });

      if (existing) {
        throw new AppError(
          "An account with this email already exists.",
          409,
          "EMAIL_EXISTS",
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.username ? { username: data.username.trim() } : {}),
        ...(data.email !== undefined
          ? {
              email: data.email?.trim()
                ? data.email.toLowerCase().trim()
                : null,
            }
          : {}),
        ...(data.phone !== undefined
          ? { phone: data.phone?.trim() || null }
          : {}),
        ...(data.address !== undefined
          ? { address: data.address?.trim() || null }
          : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        status: true,
        warehouseId: true,
        warehouse: {
          select: { id: true, name: true, code: true },
        },
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAudit({
      actorId: userId,
      action: "USER_PROFILE_UPDATED",
      entityType: "User",
      entityId: userId,
      metadata: {
        username: updated.username,
        email: updated.email,
        name: updated.name,
      },
    });

    return updated;
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        status: true,
        warehouseId: true,
        warehouse: {
          select: { id: true, name: true, code: true },
        },
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    return user;
  }
}
