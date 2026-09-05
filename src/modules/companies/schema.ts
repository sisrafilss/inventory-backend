import { z } from "zod";

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2, "Company name must be at least 2 characters").max(100),
    code: z.string().max(30).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateCompanySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid company ID"),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    code: z.string().max(30).optional(),
    description: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const listCompaniesSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    isActive: z.enum(["true", "false"]).optional(),
  }),
});
