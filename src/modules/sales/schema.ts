import { z } from "zod";
import { SaleStatus } from "@prisma/client";

export const createSaleSchema = z.object({
  body: z.object({
    customerId: z.string().uuid("Invalid customer ID").optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    warehouseId: z.string().uuid("Invalid warehouse ID").optional(),
    paymentType: z.enum(["CASH", "CREDIT"]).default("CASH"),
    paidAmount: z.number().min(0, "Paid amount cannot be negative").optional(),
    note: z.string().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid("Invalid product ID"),
          warehouseId: z.string().uuid("Invalid warehouse ID").optional(),
          quantity: z.number().int().min(1, "Quantity must be at least 1"),
          unitPrice: z.number().min(0, "Unit price cannot be negative").optional(),
        }),
      )
      .min(1, "Sale must include at least one item"),
  }),
});

export const listSalesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.nativeEnum(SaleStatus).optional(),
    createdById: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});
