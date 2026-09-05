import { z } from "zod";

export const createExpenseSchema = z.object({
  body: z.object({
    title: z.string().min(2, "Expense title is required").max(100),
    category: z.string().min(2).max(50).default("OTHER"),
    amount: z.number().positive("Amount must be greater than 0"),
    date: z.string().optional(),
    note: z.string().max(500).optional(),
  }),
});

export const updateExpenseSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense ID"),
  }),
  body: z.object({
    title: z.string().min(2).max(100).optional(),
    category: z.string().min(2).max(50).optional(),
    amount: z.number().positive().optional(),
    date: z.string().optional(),
    note: z.string().max(500).optional().nullable(),
  }),
});

export const listExpensesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    category: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().optional(),
  }),
});
