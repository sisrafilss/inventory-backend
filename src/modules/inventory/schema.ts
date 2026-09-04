import { z } from "zod";
import { StockMovementType } from "@prisma/client";

export const createAdjustmentSchema = z.object({
  body: z.object({
    productId: z.string().uuid("Invalid product ID"),
    type: z.enum([
      StockMovementType.RESTOCK,
      StockMovementType.DAMAGE,
      StockMovementType.LOSS,
      StockMovementType.RETURN,
      StockMovementType.CORRECTION,
      StockMovementType.OTHER,
    ]),
    quantity: z
      .number()
      .int()
      .refine((val) => val !== 0, "Quantity cannot be zero"),
    reason: z.string().min(3, "Reason/note must be at least 3 characters"),
  }),
});

export const listMovementsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    productId: z.string().optional(),
    performedById: z.string().optional(),
    type: z.nativeEnum(StockMovementType).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});
