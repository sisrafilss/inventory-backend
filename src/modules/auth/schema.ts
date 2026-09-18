import { z } from "zod";

export const loginSchema = z.object({
  body: z
    .object({
      username: z.string().min(1, "Username is required").optional(),
      email: z.string().optional(),
      password: z.string().min(1, "Password is required"),
    })
    .refine((data) => Boolean(data.username?.trim() || data.email?.trim()), {
      message: "Username is required",
      path: ["username"],
    }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username cannot exceed 50 characters")
      .regex(
        /^[a-zA-Z0-9_.-]+$/,
        "Username can only contain letters, numbers, underscores, dashes, and periods",
      )
      .optional(),
    email: z
      .string()
      .email("Invalid email address")
      .optional()
      .nullable()
      .or(z.literal("")),
    phone: z.string().optional().nullable().or(z.literal("")),
    address: z.string().optional().nullable().or(z.literal("")),
  }),
});
