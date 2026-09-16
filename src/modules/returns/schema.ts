import { z } from "zod";

export const returnItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
});

export const createSalesReturnSchema = z.object({
  saleId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  refundType: z.enum(["CASH", "CREDIT_ADJUSTMENT"]).default("CASH"),
  refundAmount: z.number().min(0, "Refund amount cannot be negative").default(0),
  reason: z.string().optional().nullable(),
  items: z.array(returnItemSchema).min(1, "At least one item must be returned"),
});

export const createPurchaseReturnSchema = z.object({
  purchaseId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  refundType: z.enum(["CASH", "CREDIT_ADJUSTMENT"]).default("CASH"),
  refundAmount: z.number().min(0, "Refund amount cannot be negative").default(0),
  reason: z.string().optional().nullable(),
  items: z.array(returnItemSchema).min(1, "At least one item must be returned"),
});

export const listReturnsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
