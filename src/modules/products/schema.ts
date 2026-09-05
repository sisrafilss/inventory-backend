import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Product name must be at least 2 characters"),
    sku: z.string().min(2, "SKU must be at least 2 characters").toUpperCase(),
    barcode: z.string().max(50).optional().nullable(),
    categoryId: z.string().uuid("Valid category ID required"),
    companyId: z.string().uuid("Valid company ID required").optional().nullable(),
    unit: z.string().min(1, "Unit is required").default("piece"),
    dpRate: z.number().min(0, "DP Rate cannot be negative").default(0),
    costPrice: z.number().min(0, "Cost price cannot be negative"),
    sellingPrice: z.number().min(0, "Selling price cannot be negative"),
    quantity: z
      .number()
      .int()
      .min(0, "Initial quantity cannot be negative")
      .default(0),
    reorderLevel: z
      .number()
      .int()
      .min(0, "Reorder level cannot be negative")
      .default(10),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID"),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    sku: z.string().min(2).toUpperCase().optional(),
    barcode: z.string().max(50).optional().nullable(),
    categoryId: z.string().uuid().optional(),
    companyId: z.string().uuid().optional().nullable(),
    unit: z.string().min(1).optional(),
    dpRate: z.number().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    reorderLevel: z.number().int().min(0).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const listProductsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    categoryId: z.string().optional(),
    companyId: z.string().optional(),
    warehouseId: z.string().optional(),
    isActive: z.string().optional(),
    stockStatus: z
      .enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"])
      .optional(),
  }),
});
