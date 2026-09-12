import { z } from "zod";
import { SaleStatus } from "@prisma/client";

export const createSaleSchema = z.object({
  body: z.object({
    referenceNumber: z.string().max(100).optional(),
    customerId: z.string().uuid("Invalid customer ID").optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerAddress: z.string().optional(),
    warehouseId: z.string().uuid("Invalid warehouse ID").optional(),
    paymentType: z.enum(["CASH", "CREDIT"]).default("CASH"),
    discount: z.number().min(0, "Discount cannot be negative").default(0),
    discountPercent: z
      .number()
      .min(0, "Discount percent cannot be negative")
      .max(100, "Discount percent cannot exceed 100%")
      .optional(),
    paidAmount: z.number().min(0, "Paid amount cannot be negative").optional(),
    note: z.string().optional(),
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid("Invalid product ID"),
            warehouseId: z.string().uuid("Invalid warehouse ID").optional(),
            quantity: z.number().min(0, "Quantity cannot be negative"),
            packSize: z.number().positive().optional().nullable(),
            looseQuantity: z.number().min(0).optional().nullable(),
            unitPrice: z
              .number()
              .min(0, "Unit price cannot be negative")
              .optional(),
            purchaseCost: z
              .number()
              .min(0, "Purchase cost cannot be negative")
              .optional(),
          })
          .refine(
            (item) =>
              item.quantity > 0 ||
              (item.looseQuantity !== undefined &&
                item.looseQuantity !== null &&
                item.looseQuantity > 0),
            { message: "Quantity and loose quantity cannot both be zero." },
          ),
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
