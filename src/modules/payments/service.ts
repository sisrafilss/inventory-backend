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
      date?: string;
      srUserId?: string | null;
      srName?: string | null;
    },
  ) {
    return prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: data.customerId },
        });
        if (!customer) {
          throw new AppError("Customer not found.", 404, "CUSTOMER_NOT_FOUND");
        }

        const customerDue = Number(customer.currentDue);
        if (customerDue <= 0) {
          throw new AppError(
            `Customer "${customer.name}" has no outstanding due (৳0.00). Cannot collect payment.`,
            400,
            "NO_DUE_OUTSTANDING",
          );
        }

        if (data.amount > customerDue) {
          throw new AppError(
            `Collection amount (৳${data.amount.toLocaleString()}) cannot exceed customer's outstanding due (৳${customerDue.toLocaleString()}).`,
            400,
            "AMOUNT_EXCEEDS_DUE",
          );
        }

        // Check if an SR is specified and validate/decrement SR due
        let effectiveSrName = data.srName?.trim() || null;
        let effectiveSrUserId = data.srUserId || null;

        if (effectiveSrUserId && !effectiveSrName) {
          const srUser = await tx.user.findUnique({
            where: { id: effectiveSrUserId },
            select: { name: true },
          });
          if (srUser) effectiveSrName = srUser.name;
        }

        let matchedSrDue = null;
        if (effectiveSrName) {
          matchedSrDue = await tx.customerSrDue.findFirst({
            where: {
              customerId: data.customerId,
              OR: [
                { srName: { equals: effectiveSrName, mode: "insensitive" } },
                ...(effectiveSrUserId ? [{ srUserId: effectiveSrUserId }] : []),
              ],
            },
          });

          if (matchedSrDue) {
            const srDueAmount = Number(matchedSrDue.currentDue);
            if (data.amount > srDueAmount) {
              throw new AppError(
                `Collection amount (৳${data.amount.toLocaleString()}) cannot exceed SR "${matchedSrDue.srName}"'s outstanding due (৳${srDueAmount.toLocaleString()}).`,
                400,
                "AMOUNT_EXCEEDS_SR_DUE",
              );
            }

            await tx.customerSrDue.update({
              where: { id: matchedSrDue.id },
              data: {
                currentDue: {
                  decrement: data.amount,
                },
              },
            });
          }
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
            srUserId: effectiveSrUserId,
            srName: effectiveSrName,
            createdById: actorId,
            ...(data.date ? { createdAt: new Date(data.date) } : {}),
          },
          include: {
            customer: true,
            srUser: { select: { id: true, name: true, phone: true } },
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
              srName: effectiveSrName,
              srUserId: effectiveSrUserId,
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
      date?: string;
    },
  ) {
    return prisma.$transaction(
      async (tx) => {
        const supplier = await tx.supplier.findUnique({
          where: { id: data.supplierId },
        });
        if (!supplier) {
          throw new AppError("Supplier not found.", 404, "SUPPLIER_NOT_FOUND");
        }

        const supplierDue = Number(supplier.currentDue);
        if (supplierDue <= 0) {
          throw new AppError(
            `Supplier "${supplier.name}" has no outstanding payable due (৳0.00). Cannot make payout.`,
            400,
            "NO_DUE_OUTSTANDING",
          );
        }

        if (data.amount > supplierDue) {
          throw new AppError(
            `Payout amount (৳${data.amount.toLocaleString()}) cannot exceed supplier's payable due (৳${supplierDue.toLocaleString()}).`,
            400,
            "AMOUNT_EXCEEDS_DUE",
          );
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
            ...(data.date ? { createdAt: new Date(data.date) } : {}),
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
    srUserId?: string;
    srName?: string;
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
    if (query.srUserId) where.srUserId = query.srUserId;
    if (query.srName)
      where.srName = { contains: query.srName, mode: "insensitive" };
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
          supplier: {
            select: { id: true, name: true, companyName: true, phone: true },
          },
          srUser: { select: { id: true, name: true, phone: true } },
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
        customer: { include: { srDues: true } },
        supplier: true,
        srUser: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!payment) {
      throw new AppError(
        "Payment transaction not found.",
        404,
        "PAYMENT_NOT_FOUND",
      );
    }

    return payment;
  }

  static async getByTransaction(transactionId: string) {
    const query = transactionId.trim();
    if (!query) {
      throw new AppError(
        "Transaction ID is required.",
        400,
        "INVALID_TRANSACTION_ID",
      );
    }

    const payment = await prisma.partyPayment.findFirst({
      where: {
        OR: [
          { receiptNumber: { equals: query, mode: "insensitive" } },
          { id: { equals: query, mode: "insensitive" } },
          { receiptNumber: { contains: query, mode: "insensitive" } },
          { id: { startsWith: query, mode: "insensitive" } },
        ],
      },
      include: {
        customer: { include: { srDues: true } },
        supplier: true,
        srUser: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!payment) {
      throw new AppError(
        `Transaction "${query}" not found in database.`,
        404,
        "TRANSACTION_NOT_FOUND",
      );
    }

    return payment;
  }

  static async updatePayment(
    id: string,
    actorId: string,
    data: {
      amount?: number;
      paymentMethod?: string;
      referenceNote?: string;
      date?: string;
      srUserId?: string | null;
      srName?: string | null;
    },
  ) {
    return prisma.$transaction(
      async (tx) => {
        const payment = await tx.partyPayment.findUnique({
          where: { id },
          include: { customer: true, supplier: true },
        });

        if (!payment) {
          throw new AppError(
            "Payment transaction not found.",
            404,
            "PAYMENT_NOT_FOUND",
          );
        }

        const oldAmount = Number(payment.amount);
        const newAmount =
          data.amount !== undefined ? Number(data.amount) : oldAmount;
        const diff = newAmount - oldAmount;

        const effectiveSrName =
          data.srName !== undefined
            ? data.srName?.trim() || null
            : payment.srName;
        const effectiveSrUserId =
          data.srUserId !== undefined
            ? data.srUserId || null
            : payment.srUserId;

        if (diff !== 0) {
          if (
            payment.type === "CUSTOMER_COLLECTION" &&
            payment.customerId &&
            payment.customer
          ) {
            const maxAllowed = Number(payment.customer.currentDue) + oldAmount;
            if (newAmount > maxAllowed) {
              throw new AppError(
                `Updated collection amount (৳${newAmount.toLocaleString()}) cannot exceed customer's total due before this transaction (৳${maxAllowed.toLocaleString()}).`,
                400,
                "AMOUNT_EXCEEDS_DUE",
              );
            }

            await tx.customer.update({
              where: { id: payment.customerId },
              data: {
                currentDue: {
                  decrement: diff,
                },
              },
            });

            // If an SR was assigned, adjust SR due record as well
            if (effectiveSrName) {
              const srDueRecord = await tx.customerSrDue.findFirst({
                where: {
                  customerId: payment.customerId,
                  OR: [
                    {
                      srName: { equals: effectiveSrName, mode: "insensitive" },
                    },
                    ...(effectiveSrUserId
                      ? [{ srUserId: effectiveSrUserId }]
                      : []),
                  ],
                },
              });
              if (srDueRecord) {
                const maxSrAllowed = Number(srDueRecord.currentDue) + oldAmount;
                if (newAmount > maxSrAllowed) {
                  throw new AppError(
                    `Updated collection amount (৳${newAmount.toLocaleString()}) cannot exceed SR "${srDueRecord.srName}"'s total due before this transaction (৳${maxSrAllowed.toLocaleString()}).`,
                    400,
                    "AMOUNT_EXCEEDS_SR_DUE",
                  );
                }
                await tx.customerSrDue.update({
                  where: { id: srDueRecord.id },
                  data: {
                    currentDue: {
                      decrement: diff,
                    },
                  },
                });
              }
            }
          } else if (
            payment.type === "SUPPLIER_PAYMENT" &&
            payment.supplierId &&
            payment.supplier
          ) {
            const maxAllowed = Number(payment.supplier.currentDue) + oldAmount;
            if (newAmount > maxAllowed) {
              throw new AppError(
                `Updated payout amount (৳${newAmount.toLocaleString()}) cannot exceed supplier's total payable before this transaction (৳${maxAllowed.toLocaleString()}).`,
                400,
                "AMOUNT_EXCEEDS_DUE",
              );
            }

            await tx.supplier.update({
              where: { id: payment.supplierId },
              data: {
                currentDue: {
                  decrement: diff,
                },
              },
            });
          }
        }

        const updatedPayment = await tx.partyPayment.update({
          where: { id },
          data: {
            amount: newAmount,
            paymentMethod: data.paymentMethod ?? payment.paymentMethod,
            referenceNote:
              data.referenceNote !== undefined
                ? data.referenceNote
                : payment.referenceNote,
            srUserId: effectiveSrUserId,
            srName: effectiveSrName,
            ...(data.date ? { createdAt: new Date(data.date) } : {}),
          },
          include: {
            customer: true,
            supplier: true,
            srUser: { select: { id: true, name: true, phone: true } },
            createdBy: { select: { id: true, name: true, role: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: "PARTY_PAYMENT_UPDATED",
            entityType: "PartyPayment",
            entityId: payment.id,
            metadata: {
              receiptNumber: payment.receiptNumber,
              oldAmount,
              newAmount,
              diff,
              srName: effectiveSrName,
              srUserId: effectiveSrUserId,
            },
          },
        });

        return updatedPayment;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  static async deletePayment(id: string, actorId: string) {
    return prisma.$transaction(
      async (tx) => {
        const payment = await tx.partyPayment.findUnique({
          where: { id },
        });

        if (!payment) {
          throw new AppError(
            "Payment transaction not found.",
            404,
            "PAYMENT_NOT_FOUND",
          );
        }

        const amount = Number(payment.amount);

        // Reverse party balance adjustments
        if (payment.type === "CUSTOMER_COLLECTION" && payment.customerId) {
          await tx.customer.update({
            where: { id: payment.customerId },
            data: {
              currentDue: {
                increment: amount,
              },
            },
          });

          // Restore CustomerSrDue if this collection had an assigned SR
          if (payment.srName) {
            const srDueRecord = await tx.customerSrDue.findFirst({
              where: {
                customerId: payment.customerId,
                OR: [
                  { srName: { equals: payment.srName, mode: "insensitive" } },
                  ...(payment.srUserId ? [{ srUserId: payment.srUserId }] : []),
                ],
              },
            });
            if (srDueRecord) {
              await tx.customerSrDue.update({
                where: { id: srDueRecord.id },
                data: {
                  currentDue: {
                    increment: amount,
                  },
                },
              });
            }
          }
        } else if (payment.type === "SUPPLIER_PAYMENT" && payment.supplierId) {
          await tx.supplier.update({
            where: { id: payment.supplierId },
            data: {
              currentDue: {
                increment: amount,
              },
            },
          });
        }

        await tx.partyPayment.delete({
          where: { id },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: "PARTY_PAYMENT_DELETED",
            entityType: "PartyPayment",
            entityId: payment.id,
            metadata: {
              receiptNumber: payment.receiptNumber,
              type: payment.type,
              restoredAmount: amount,
              srName: payment.srName,
              srUserId: payment.srUserId,
            },
          },
        });

        return {
          success: true,
          message: "Transaction deleted and balance successfully restored.",
          receiptNumber: payment.receiptNumber,
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }
}
