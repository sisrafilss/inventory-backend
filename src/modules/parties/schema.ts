import { z } from "zod";

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Supplier name is required").max(100),
    companyName: z.string().max(100).optional(),
    phone: z.string().min(5, "Valid phone number is required").max(30),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    address: z.string().max(300).optional(),
    openingDue: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid supplier ID"),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    companyName: z.string().max(100).optional().nullable(),
    phone: z.string().min(5).max(30).optional(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    address: z.string().max(300).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Customer name is required").max(100),
    phone: z.string().min(5, "Valid phone number is required").max(30),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    address: z.string().max(300).optional(),
    openingDue: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid customer ID"),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(5).max(30).optional(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    address: z.string().max(300).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const listPartiesSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    isActive: z.enum(["true", "false"]).optional(),
    hasDue: z.enum(["true", "false"]).optional(),
  }),
});
