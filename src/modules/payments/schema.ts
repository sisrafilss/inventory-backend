import { z } from "zod";

export const collectFromCustomerSchema = z.object({
  body: z.object({
    customerId: z.string().uuid("Invalid customer ID"),
    amount: z.number().positive("Amount must be greater than 0"),
    paymentMethod: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "CHEQUE"]).default("CASH"),
    referenceNote: z.string().max(500).optional(),
  }),
});

export const payToSupplierSchema = z.object({
  body: z.object({
    supplierId: z.string().uuid("Invalid supplier ID"),
    amount: z.number().positive("Amount must be greater than 0"),
    paymentMethod: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "CHEQUE"]).default("CASH"),
    referenceNote: z.string().max(500).optional(),
  }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    type: z.enum(["CUSTOMER_COLLECTION", "SUPPLIER_PAYMENT"]).optional(),
    customerId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
    paymentMethod: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});
