import { z } from "zod";

export const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Warehouse name must be at least 2 characters").max(100),
    code: z.string().max(30).optional(),
    address: z.string().max(300).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateWarehouseSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid warehouse ID"),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    code: z.string().max(30).optional(),
    address: z.string().max(300).optional().nullable(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const listWarehousesSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    isActive: z.enum(["true", "false"]).optional(),
  }),
});

export const transferStockSchema = z.object({
  body: z.object({
    sourceWarehouseId: z.string().uuid("Invalid source warehouse ID"),
    targetWarehouseId: z.string().uuid("Invalid target warehouse ID"),
    productId: z.string().uuid("Invalid product ID"),
    quantity: z.number().int().positive("Quantity must be greater than 0"),
    note: z.string().max(500).optional(),
  }),
});
