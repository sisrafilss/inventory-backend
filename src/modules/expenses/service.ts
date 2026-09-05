import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { Prisma } from "@prisma/client";

export class ExpensesService {
  static async listExpenses(query: {
    page?: number;
    limit?: number;
    category?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
      ];
    }

    const [expenses, total, sumAggregate] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      expenses,
      totalAmount: Number(sumAggregate._sum.amount || 0),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getExpenseById(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!expense) {
      throw new AppError("Expense not found.", 404, "EXPENSE_NOT_FOUND");
    }

    return expense;
  }

  static async createExpense(
    actorId: string,
    data: {
      title: string;
      category: string;
      amount: number;
      date?: string;
      note?: string;
    },
  ) {
    const expense = await prisma.expense.create({
      data: {
        title: data.title.trim(),
        category: data.category.toUpperCase().trim(),
        amount: data.amount,
        date: data.date ? new Date(data.date) : new Date(),
        note: data.note ? data.note.trim() : null,
        createdById: actorId,
      },
    });

    await logAudit({
      actorId,
      action: "EXPENSE_CREATED",
      entityType: "Expense",
      entityId: expense.id,
      metadata: { title: expense.title, amount: expense.amount, category: expense.category },
    });

    return expense;
  }

  static async updateExpense(
    actorId: string,
    id: string,
    data: {
      title?: string;
      category?: string;
      amount?: number;
      date?: string;
      note?: string | null;
    },
  ) {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new AppError("Expense not found.", 404, "EXPENSE_NOT_FOUND");
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title.trim() }),
        ...(data.category && { category: data.category.toUpperCase().trim() }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.note !== undefined && { note: data.note ? data.note.trim() : null }),
      },
    });

    await logAudit({
      actorId,
      action: "EXPENSE_UPDATED",
      entityType: "Expense",
      entityId: updated.id,
      metadata: { previous: expense, updated },
    });

    return updated;
  }

  static async deleteExpense(actorId: string, id: string) {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new AppError("Expense not found.", 404, "EXPENSE_NOT_FOUND");
    }

    await prisma.expense.delete({ where: { id } });

    await logAudit({
      actorId,
      action: "EXPENSE_DELETED",
      entityType: "Expense",
      entityId: id,
      metadata: { title: expense.title, amount: expense.amount },
    });

    return { message: "Expense deleted successfully." };
  }
}
