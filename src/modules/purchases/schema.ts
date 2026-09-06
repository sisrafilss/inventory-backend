import { z } from "zod";

export const purchaseItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  warehouseId: z.string().uuid("Invalid warehouse ID").optional(),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
  dpRate: z.number().min(0, "DP Rate cannot be negative").default(0),
  commissionPercent: z.number().min(0).max(100).default(0),
  purchaseRate: z.number().min(0, "Purchase rate cannot be negative"),
});

export const createPurchaseSchema = z.object({
  body: z.object({
    invoiceNumber: z.string().max(100).optional(),
    supplierId: z.string().uuid("Invalid supplier ID").optional().nullable(),
    supplierName: z.string().max(100).optional(),
    paymentType: z.enum(["CASH", "SUPPLIER"]).default("CASH"),
    paidAmount: z.number().min(0).default(0),
    items: z.array(purchaseItemInputSchema).min(1, "Purchase must contain at least one item"),
    note: z.string().max(500).optional(),
    warehouseId: z.string().uuid("Invalid default warehouse ID").optional(),
  }),
});

export const listPurchasesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    supplierId: z.string().uuid().optional(),
    paymentType: z.enum(["CASH", "SUPPLIER"]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().optional(),
  }),
});
