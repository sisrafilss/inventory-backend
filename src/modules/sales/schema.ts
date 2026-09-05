import { z } from "zod";
import { SaleStatus } from "@prisma/client";

export const createSaleSchema = z.object({
  body: z.object({
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    note: z.string().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid("Invalid product ID"),
          quantity: z.number().int().min(1, "Quantity must be at least 1"),
        }),
      )
      .min(1, "Sale must include at least one item"),
  }),
});

export const rejectSaleSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid sale ID"),
  }),
  body: z.object({
    reason: z.string().min(3, "Rejection reason must be at least 3 characters"),
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
