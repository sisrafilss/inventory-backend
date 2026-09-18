import { z } from "zod";
import { Role, UserStatus } from "@prisma/client";

export const createUserSchema = z.object({
  body: z
    .object({
      username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(50, "Username cannot exceed 50 characters")
        .regex(
          /^[a-zA-Z0-9_.-]+$/,
          "Username can only contain letters, numbers, underscores, dashes, and periods",
        )
        .optional()
        .nullable()
        .or(z.literal("")),
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: z
        .string()
        .email("Invalid email address")
        .optional()
        .nullable()
        .or(z.literal("")),
      role: z.enum([Role.ADMIN, Role.MANAGER, Role.SR]),
      password: z
        .string()
        .min(6, "Password must be at least 6 characters")
        .optional()
        .nullable()
        .or(z.literal("")),
      phone: z.string().optional().nullable().or(z.literal("")),
      address: z.string().optional().nullable().or(z.literal("")),
      warehouseId: z
        .string()
        .uuid("Invalid warehouse ID")
        .optional()
        .nullable()
        .or(z.literal("")),
      warehouseIds: z
        .array(z.string().uuid("Invalid warehouse ID"))
        .optional()
        .nullable(),
    })
    .refine(
      (data) => {
        if (data.role !== Role.SR) {
          return !!data.username && data.username.trim().length >= 3;
        }
        return true;
      },
      {
        message:
          "Username is required for Admin and Manager accounts (at least 3 characters)",
        path: ["username"],
      },
    )
    .refine(
      (data) => {
        if (data.role !== Role.SR) {
          return !!data.password && data.password.length >= 6;
        }
        return true;
      },
      {
        message:
          "Password is required for Admin and Manager accounts (at least 6 characters)",
        path: ["password"],
      },
    ),
});

export const updateUserSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username cannot exceed 50 characters")
      .regex(
        /^[a-zA-Z0-9_.-]+$/,
        "Username can only contain letters, numbers, underscores, dashes, and periods",
      )
      .optional()
      .nullable()
      .or(z.literal("")),
    name: z.string().min(2).optional(),
    email: z
      .string()
      .email("Invalid email address")
      .optional()
      .nullable()
      .or(z.literal("")),
    phone: z.string().optional().nullable().or(z.literal("")),
    address: z.string().optional().nullable().or(z.literal("")),
    role: z.enum([Role.ADMIN, Role.MANAGER, Role.SR]).optional(),
    warehouseId: z
      .string()
      .uuid("Invalid warehouse ID")
      .optional()
      .nullable()
      .or(z.literal("")),
    warehouseIds: z
      .array(z.string().uuid("Invalid warehouse ID"))
      .optional()
      .nullable(),
  }),
});

export const updateStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID"),
  }),
  body: z.object({
    status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE]),
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID"),
  }),
  body: z.object({
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    role: z.nativeEnum(Role).optional(),
    status: z.nativeEnum(UserStatus).optional(),
  }),
});
