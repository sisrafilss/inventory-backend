import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { SaleStatus, StockMovementType, Role, Prisma } from "@prisma/client";

export class SalesService {
  private static generateReferenceNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SAL-${timestamp}-${random}`;
  }

  private static formatSaleResponse(sale: any, requestUserRole?: Role) {
    const isManager = requestUserRole === Role.MANAGER;
    let invoiceCost = 0;

    const items = sale.items.map((i: any) => {
      const unitPrice = Number(i.unitPrice);
      const lineTotal = Number(i.lineTotal);
      const purchaseCost = Number(i.purchaseCost || 0);
      const lineCost = purchaseCost * i.quantity;
      invoiceCost += lineCost;
      const profit = lineTotal - lineCost;

      if (isManager) {
        return {
          id: i.id,
          saleId: i.saleId,
          productId: i.productId,
          warehouseId: i.warehouseId,
          warehouse: i.warehouse,
          product: i.product,
          quantity: i.quantity,
          unitPrice,
          lineTotal,
        };
      }

      return {
        id: i.id,
        saleId: i.saleId,
        productId: i.productId,
        warehouseId: i.warehouseId,
        warehouse: i.warehouse,
        product: i.product,
        quantity: i.quantity,
        purchaseCost,
        unitPrice,
        lineTotal,
        profit,
      };
    });

    const totalAmount = Number(sale.totalAmount);
    const paidAmount = Number(sale.paidAmount || 0);
    const dueAmount = Number(sale.dueAmount || 0);

    const baseResult = {
      ...sale,
      totalAmount,
      paidAmount,
      dueAmount,
      items,
    };

    if (!isManager) {
      return {
        ...baseResult,
        invoiceCost,
        invoiceProfit: totalAmount - invoiceCost,
      };
    }

    return baseResult;
  }

  static async createSale(
    createdById: string,
    data: {
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      warehouseId?: string;
      paymentType?: "CASH" | "CREDIT";
      paidAmount?: number;
      note?: string;
      items: Array<{
        productId: string;
        warehouseId?: string;
        quantity: number;
        unitPrice?: number;
      }>;
    },
  ) {
    let customerName = data.customerName?.trim() || null;
    let customerPhone = data.customerPhone?.trim() || null;

    if (data.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
      });
      if (!customer) {
        throw new AppError("Customer not found.", 404, "CUSTOMER_NOT_FOUND");
      }
      if (!customerName) customerName = customer.name;
      if (!customerPhone) customerPhone = customer.phone;
    }

    // 1. Fetch products to get current selling prices & purchase costs
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new AppError(
          `Product with ID "${item.productId}" not found.`,
          404,
          "PRODUCT_NOT_FOUND",
        );
      }
      if (!prod.isActive) {
        throw new AppError(
          `Product "${prod.name}" is currently inactive and cannot be sold.`,
          400,
          "PRODUCT_INACTIVE",
        );
      }
    }

    // 2. Calculate line totals and grand total accurately
    let totalAmount = 0;
    const saleItemsData = data.items.map((item) => {
      const prod = productMap.get(item.productId)!;
      const unitPrice =
        item.unitPrice !== undefined && item.unitPrice >= 0
          ? Number(item.unitPrice)
          : Number(prod.sellingPrice);
      const purchaseCost = Number(prod.costPrice || 0);
      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      return {
        productId: item.productId,
        warehouseId: item.warehouseId || data.warehouseId || null,
        quantity: item.quantity,
        purchaseCost,
        unitPrice,
        lineTotal,
      };
    });

    const paymentType = data.paymentType || "CASH";
    let paidAmount = 0;
    if (data.paidAmount !== undefined) {
      paidAmount = Number(data.paidAmount);
    } else {
      paidAmount = paymentType === "CREDIT" ? 0 : totalAmount;
    }
    const dueAmount = Math.max(0, totalAmount - paidAmount);

    const referenceNumber = this.generateReferenceNumber();

    // 3. Create Sale as PENDING without deducting inventory yet
    const sale = await prisma.sale.create({
      data: {
        referenceNumber,
        createdById,
        customerId: data.customerId || null,
        warehouseId: data.warehouseId || null,
        paymentType,
        status: SaleStatus.PENDING,
        totalAmount,
        paidAmount,
        dueAmount,
        customerName,
        customerPhone,
        note: data.note?.trim() || null,
        items: {
          create: saleItemsData,
        },
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, currentDue: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true },
            },
            warehouse: {
              select: { id: true, name: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logAudit({
      actorId: createdById,
      action: "SALE_SUBMITTED",
      entityType: "Sale",
      entityId: sale.id,
      metadata: {
        referenceNumber: sale.referenceNumber,
        totalAmount,
        paymentType,
        itemCount: sale.items.length,
      },
    });

    return this.formatSaleResponse(sale);
  }

  static async listSales(
    requestUser: { id: string; role: Role },
    query: {
      page?: number;
      limit?: number;
      status?: SaleStatus;
      createdById?: string;
      customerId?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {};

    if (query.createdById) {
      where.createdById = query.createdById;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { referenceNumber: { contains: s, mode: "insensitive" } },
        { customerName: { contains: s, mode: "insensitive" } },
        { customerPhone: { contains: s, mode: "insensitive" } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, name: true, phone: true, currentDue: true },
          },
          warehouse: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
          rejectedBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, unit: true },
              },
              warehouse: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    const formattedSales = sales.map((s) =>
      this.formatSaleResponse(s, requestUser.role),
    );

    return {
      sales: formattedSales,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSaleById(
    requestUser: { id: string; role: Role },
    id: string,
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, address: true, currentDue: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, phone: true },
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
        rejectedBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                quantity: true,
                costPrice: requestUser.role !== Role.MANAGER,
                sellingPrice: true,
                company: { select: { id: true, name: true } },
              },
            },
            warehouse: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new AppError("Sale not found.", 404, "SALE_NOT_FOUND");
    }

    return this.formatSaleResponse(sale, requestUser.role);
  }

  static async approveSale(approverId: string, id: string) {
    // Transaction-safe approval with stock deduction and customer credit adjustment
    return await prisma.$transaction(
      async (tx) => {
        // 1. Fetch sale
        const sale = await tx.sale.findUnique({
          where: { id },
          include: {
            items: true,
          },
        });

        if (!sale) {
          throw new AppError("Sale not found.", 404, "SALE_NOT_FOUND");
        }

        // 2. Concurrency / Duplicate Approval Prevention
        if (sale.status !== SaleStatus.PENDING) {
          throw new AppError(
            `Cannot approve sale: Status is already ${sale.status}.`,
            409,
            "SALE_NOT_PENDING",
          );
        }

        // 3. Verify product availability and stock
        for (const item of sale.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new AppError(
              `Product with ID "${item.productId}" no longer exists.`,
              404,
              "PRODUCT_NOT_FOUND",
            );
          }

          if (product.quantity < item.quantity) {
            throw new AppError(
              `Insufficient stock for "${product.name}" (SKU: ${product.sku}). Available: ${product.quantity}, Required: ${item.quantity}.`,
              400,
              "INSUFFICIENT_STOCK",
            );
          }

          // Decrement global stock
          const qtyBefore = product.quantity;
          const qtyAfter = qtyBefore - item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: qtyAfter },
          });

          // Decrement warehouse stock if warehouseId is set
          const targetWarehouseId = item.warehouseId || sale.warehouseId;
          if (targetWarehouseId) {
            const whStock = await tx.warehouseStock.findUnique({
              where: {
                warehouseId_productId: {
                  warehouseId: targetWarehouseId,
                  productId: item.productId,
                },
              },
            });

            if (whStock) {
              await tx.warehouseStock.update({
                where: { id: whStock.id },
                data: { quantity: { decrement: item.quantity } },
              });
            } else {
              await tx.warehouseStock.create({
                data: {
                  warehouseId: targetWarehouseId,
                  productId: item.productId,
                  quantity: -item.quantity,
                },
              });
            }
          }

          // Create immutable negative stock movement
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: StockMovementType.SALE_DEDUCTION,
              quantityBefore: qtyBefore,
              quantityChange: -item.quantity,
              quantityAfter: qtyAfter,
              referenceType: "SALE",
              referenceId: sale.id,
              reason: `Deducted upon sale approval (#${sale.referenceNumber})`,
              performedById: approverId,
            },
          });
        }

        // 4. Update Customer Dues if sale has dueAmount > 0 and customerId is set
        const due = Number(sale.dueAmount);
        if (sale.customerId && due > 0) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              currentDue: { increment: due },
            },
          });
        }

        // 5. Update Sale status to APPROVED
        const approvedSale = await tx.sale.update({
          where: { id },
          data: {
            status: SaleStatus.APPROVED,
            approvedById: approverId,
            approvedAt: new Date(),
          },
          include: {
            customer: {
              select: { id: true, name: true, phone: true, currentDue: true },
            },
            warehouse: {
              select: { id: true, name: true },
            },
            createdBy: {
              select: { id: true, name: true, email: true },
            },
            approvedBy: {
              select: { id: true, name: true, email: true },
            },
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true, unit: true },
                },
                warehouse: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        });

        // 6. Audit log
        await logAudit(
          {
            actorId: approverId,
            action: "SALE_APPROVED",
            entityType: "Sale",
            entityId: id,
            metadata: {
              referenceNumber: approvedSale.referenceNumber,
              totalAmount: Number(approvedSale.totalAmount),
              dueAmount: Number(approvedSale.dueAmount),
              createdById: approvedSale.createdById,
            },
          },
          tx,
        );

        return this.formatSaleResponse(approvedSale);
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  static async rejectSale(rejectorId: string, id: string, reason: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
    });

    if (!sale) {
      throw new AppError("Sale not found.", 404, "SALE_NOT_FOUND");
    }

    if (sale.status !== SaleStatus.PENDING) {
      throw new AppError(
        `Cannot reject sale: Status is already ${sale.status}.`,
        409,
        "SALE_NOT_PENDING",
      );
    }

    const rejectedSale = await prisma.sale.update({
      where: { id },
      data: {
        status: SaleStatus.REJECTED,
        rejectedById: rejectorId,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, currentDue: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        rejectedBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true },
            },
            warehouse: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    await logAudit({
      actorId: rejectorId,
      action: "SALE_REJECTED",
      entityType: "Sale",
      entityId: id,
      metadata: {
        referenceNumber: sale.referenceNumber,
        reason,
        createdById: sale.createdById,
      },
    });

    return this.formatSaleResponse(rejectedSale);
  }
}
