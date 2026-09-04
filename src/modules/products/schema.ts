import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Product name must be at least 2 characters"),
    sku: z.string().min(2, "SKU must be at least 2 characters").toUpperCase(),
    categoryId: z.string().uuid("Valid category ID required"),
    unit: z.string().min(1, "Unit is required").default("piece"),
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
    categoryId: z.string().uuid().optional(),
    unit: z.string().min(1).optional(),
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
    isActive: z.string().optional(),
    stockStatus: z
      .enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"])
      .optional(),
  }),
});
