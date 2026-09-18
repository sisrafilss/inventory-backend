import { prisma } from "../../config/db.js";
import { hashPassword } from "../../utils/password.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { Role, UserStatus, Prisma } from "@prisma/client";

export class UsersService {
  static async listUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
    status?: UserStatus;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
      }),
    ]);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
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

  static async createUser(
    creator: { id: string; role: Role },
    data: {
      username: string;
      name: string;
      email?: string | null;
      role: Role;
      password: string;
      phone?: string;
      address?: string;
      warehouseId?: string | null;
    },
  ) {
    if (data.role === Role.SUPER_ADMIN) {
      throw new AppError(
        "Cannot create Super Admin users.",
        403,
        "CANNOT_CREATE_SUPER_ADMIN",
      );
    }

    if (creator.role === Role.ADMIN && data.role === Role.ADMIN) {
      throw new AppError(
        "Admins cannot create other Admin users.",
        403,
        "FORBIDDEN_ROLE_CREATION",
      );
    }

    const trimmedUsername = data.username.trim();
    const existingUsername = await prisma.user.findFirst({
      where: { username: { equals: trimmedUsername, mode: "insensitive" } },
    });

    if (existingUsername) {
      throw new AppError(
        "An account with this username already exists.",
        409,
        "USERNAME_EXISTS",
      );
    }

    if (data.email && data.email.trim()) {
      const trimmedEmail = data.email.toLowerCase().trim();
      const existingEmail = await prisma.user.findFirst({
        where: { email: { equals: trimmedEmail, mode: "insensitive" } },
      });

      if (existingEmail) {
        throw new AppError(
          "An account with this email already exists.",
          409,
          "EMAIL_EXISTS",
        );
      }
    }

    const passwordHash = await hashPassword(data.password);
    const isManager = data.role === Role.MANAGER;

    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        name: data.name.trim(),
        email: data.email?.trim() ? data.email.toLowerCase().trim() : null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        passwordHash,
        role: data.role,
        status: UserStatus.ACTIVE,
        warehouseId: data.warehouseId || null,
        mustChangePassword: isManager, // Managers must change password on first login
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
        createdAt: true,
      },
    });

    await logAudit({
      actorId: creator.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      metadata: {
        username: user.username,
        role: user.role,
        email: user.email,
        name: user.name,
        warehouseId: user.warehouseId,
      },
    });

    return user;
  }

  static async updateUser(
    actorId: string,
    id: string,
    data: {
      username?: string;
      name?: string;
      email?: string | null;
      phone?: string;
      address?: string;
      role?: Role;
      warehouseId?: string | null;
    },
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    if (
      data.role &&
      data.role === Role.SUPER_ADMIN &&
      user.role !== Role.SUPER_ADMIN
    ) {
      throw new AppError(
        "Cannot promote user to Super Admin.",
        403,
        "FORBIDDEN_ROLE_UPDATE",
      );
    }

    if (data.username && data.username.trim()) {
      const trimmedUsername = data.username.trim();
      const existingUsername = await prisma.user.findFirst({
        where: {
          username: { equals: trimmedUsername, mode: "insensitive" },
          id: { not: id },
        },
      });

      if (existingUsername) {
        throw new AppError(
          "An account with this username already exists.",
          409,
          "USERNAME_EXISTS",
        );
      }
    }

    if (data.email && data.email.trim()) {
      const trimmedEmail = data.email.toLowerCase().trim();
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: { equals: trimmedEmail, mode: "insensitive" },
          id: { not: id },
        },
      });

      if (existingEmail) {
        throw new AppError(
          "An account with this email already exists.",
          409,
          "EMAIL_EXISTS",
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(data.username ? { username: data.username.trim() } : {}),
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.email !== undefined
          ? { email: data.email?.trim() ? data.email.toLowerCase().trim() : null }
          : {}),
        ...(data.phone !== undefined
          ? { phone: data.phone.trim() || null }
          : {}),
        ...(data.address !== undefined
          ? { address: data.address.trim() || null }
          : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(data.warehouseId !== undefined
          ? { warehouseId: data.warehouseId || null }
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
        updatedAt: true,
      },
    });

    await logAudit({
      actorId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: id,
      metadata: data,
    });

    return updated;
  }

  static async updateUserStatus(
    actor: { id: string; role: Role },
    id: string,
    status: UserStatus,
  ) {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    if (targetUser.id === actor.id) {
      throw new AppError(
        "You cannot change your own account active status.",
        400,
        "CANNOT_MUTATE_SELF",
      );
    }

    if (targetUser.role === Role.SUPER_ADMIN) {
      throw new AppError(
        "Cannot deactivate a Super Admin account.",
        403,
        "CANNOT_DEACTIVATE_SUPER_ADMIN",
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await logAudit({
      actorId: actor.id,
      action:
        status === UserStatus.ACTIVE ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "User",
      entityId: id,
      metadata: { previousStatus: targetUser.status, newStatus: status },
    });

    return updated;
  }

  static async resetPassword(
    actor: { id: string; role: Role },
    id: string,
    newPassword: string,
  ) {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    if (
      targetUser.role === Role.SUPER_ADMIN &&
      actor.role !== Role.SUPER_ADMIN
    ) {
      throw new AppError(
        "Only a Super Admin can reset a Super Admin password.",
        403,
        "FORBIDDEN",
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    await logAudit({
      actorId: actor.id,
      action: "USER_PASSWORD_RESET_BY_ADMIN",
      entityType: "User",
      entityId: id,
      metadata: { targetUsername: targetUser.username, targetEmail: targetUser.email },
    });

    return {
      message:
        "Password reset successfully. The user must change password upon next login.",
    };
  }

  static async listSrs() {
    const srs = await prisma.user.findMany({
      where: {
        role: Role.SR,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });
    return srs;
  }
}
