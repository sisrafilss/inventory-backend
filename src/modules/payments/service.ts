import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { Prisma } from "@prisma/client";

export class PaymentsService {
  private static generateReceiptNumber(prefix: string): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${dateStr}-${rand}`;
  }

  static async collectFromCustomer(
    actorId: string,
    data: {
      customerId: string;
      amount: number;
      paymentMethod: string;
      referenceNote?: string;
    },
  ) {
    return prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({ where: { id: data.customerId } });
        if (!customer) {
          throw new AppError("Customer not found.", 404, "CUSTOMER_NOT_FOUND");
        }

        const receiptNumber = this.generateReceiptNumber("COL");

        // Decrement customer due
        const updatedCustomer = await tx.customer.update({
          where: { id: data.customerId },
          data: {
            currentDue: {
              decrement: data.amount,
            },
          },
        });

        const payment = await tx.partyPayment.create({
          data: {
            receiptNumber,
            type: "CUSTOMER_COLLECTION",
            customerId: data.customerId,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            referenceNote: data.referenceNote || null,
            createdById: actorId,
          },
          include: {
            customer: true,
            createdBy: { select: { id: true, name: true, role: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: "CUSTOMER_COLLECTION_RECEIVED",
            entityType: "PartyPayment",
            entityId: payment.id,
            metadata: {
              receiptNumber,
              customerName: customer.name,
              amount: data.amount,
              remainingDue: updatedCustomer.currentDue,
            },
          },
        });

        return payment;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  static async payToSupplier(
    actorId: string,
    data: {
      supplierId: string;
      amount: number;
      paymentMethod: string;
      referenceNote?: string;
    },
  ) {
    return prisma.$transaction(
      async (tx) => {
        const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
        if (!supplier) {
          throw new AppError("Supplier not found.", 404, "SUPPLIER_NOT_FOUND");
        }

        const receiptNumber = this.generateReceiptNumber("PAY");

        // Decrement supplier due (payable)
        const updatedSupplier = await tx.supplier.update({
          where: { id: data.supplierId },
          data: {
            currentDue: {
              decrement: data.amount,
            },
          },
        });

        const payment = await tx.partyPayment.create({
          data: {
            receiptNumber,
            type: "SUPPLIER_PAYMENT",
            supplierId: data.supplierId,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            referenceNote: data.referenceNote || null,
            createdById: actorId,
          },
          include: {
            supplier: true,
            createdBy: { select: { id: true, name: true, role: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: "SUPPLIER_PAYMENT_MADE",
            entityType: "PartyPayment",
            entityId: payment.id,
            metadata: {
              receiptNumber,
              supplierName: supplier.name,
              amount: data.amount,
              remainingDue: updatedSupplier.currentDue,
            },
          },
        });

        return payment;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  static async listPayments(query: {
    page?: number;
    limit?: number;
    type?: string;
    customerId?: string;
    supplierId?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PartyPaymentWhereInput = {};

    if (query.type) where.type = query.type;
    if (query.customerId) where.customerId = query.customerId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [payments, total, sumAggregate] = await Promise.all([
      prisma.partyPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          supplier: { select: { id: true, name: true, companyName: true, phone: true } },
          createdBy: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.partyPayment.count({ where }),
      prisma.partyPayment.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      payments,
      totalAmount: Number(sumAggregate._sum.amount || 0),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPaymentById(id: string) {
    const payment = await prisma.partyPayment.findUnique({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!payment) {
      throw new AppError("Payment transaction not found.", 404, "PAYMENT_NOT_FOUND");
    }

    return payment;
  }
}
