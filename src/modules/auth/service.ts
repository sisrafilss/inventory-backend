import { prisma } from "../../config/db.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { signToken } from "../../utils/jwt.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { UserStatus } from "@prisma/client";

export class AuthService {
  static async login(data: { email: string; password: string }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new AppError(
        "Invalid email or password.",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError(
        "Invalid email or password.",
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

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        status: true,
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
