import { prisma } from '../../config/db.js';
import { AppError } from '../../errors/AppError.js';
import { logAudit } from '../../utils/audit.js';
import { SaleStatus, StockMovementType, Role, Prisma } from '@prisma/client';

export class SalesService {
  private static generateReferenceNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SAL-${timestamp}-${random}`;
  }

  static async createSale(
    salesOfficerId: string,
    data: {
      customerName?: string;
      customerPhone?: string;
      note?: string;
      items: Array<{ productId: string; quantity: number }>;
    }
  ) {
    // 1. Fetch products to get current selling prices and verify availability
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new AppError(`Product with ID "${item.productId}" not found.`, 404, 'PRODUCT_NOT_FOUND');
      }
      if (!prod.isActive) {
        throw new AppError(`Product "${prod.name}" is currently inactive and cannot be sold.`, 400, 'PRODUCT_INACTIVE');
      }
    }

    // 2. Calculate line totals and grand total accurately
    let totalAmount = 0;
    const saleItemsData = data.items.map((item) => {
      const prod = productMap.get(item.productId)!;
      const unitPrice = Number(prod.sellingPrice);
      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      };
    });

    const referenceNumber = this.generateReferenceNumber();

    // 3. Create Sale as PENDING without deducting inventory
    const sale = await prisma.sale.create({
      data: {
        referenceNumber,
        salesOfficerId,
        status: SaleStatus.PENDING,
        totalAmount,
        customerName: data.customerName?.trim() || null,
        customerPhone: data.customerPhone?.trim() || null,
        note: data.note?.trim() || null,
        items: {
          create: saleItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        },
        salesOfficer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logAudit({
      actorId: salesOfficerId,
      action: 'SALE_SUBMITTED',
      entityType: 'Sale',
      entityId: sale.id,
      metadata: {
        referenceNumber: sale.referenceNumber,
        totalAmount,
        itemCount: sale.items.length,
      },
    });

    return {
      ...sale,
      totalAmount: Number(sale.totalAmount),
      items: sale.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
    };
  }

  static async listSales(
    requestUser: { id: string; role: Role },
    query: {
      page?: number;
      limit?: number;
      status?: SaleStatus;
      salesOfficerId?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {};

    // Strict rule: Sales Officers can ONLY view their own sales
    if (requestUser.role === Role.SALES_OFFICER) {
      where.salesOfficerId = requestUser.id;
    } else if (query.salesOfficerId) {
      where.salesOfficerId = query.salesOfficerId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { referenceNumber: { contains: s, mode: 'insensitive' } },
        { customerName: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s, mode: 'insensitive' } },
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
        orderBy: { createdAt: 'desc' },
        include: {
          salesOfficer: {
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
            },
          },
        },
      }),
    ]);

    const formattedSales = sales.map((s) => ({
      ...s,
      totalAmount: Number(s.totalAmount),
      items: s.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
    }));

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

  static async getSaleById(requestUser: { id: string; role: Role }, id: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        salesOfficer: {
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
              select: { id: true, name: true, sku: true, unit: true, quantity: true },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new AppError('Sale not found.', 404, 'SALE_NOT_FOUND');
    }

    // Role check: Sales Officers can only view their own sale
    if (requestUser.role === Role.SALES_OFFICER && sale.salesOfficerId !== requestUser.id) {
      throw new AppError('Forbidden: You can only view your own sales.', 403, 'FORBIDDEN');
    }

    return {
      ...sale,
      totalAmount: Number(sale.totalAmount),
      items: sale.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
    };
  }

  static async approveSale(approverId: string, id: string) {
    // Transaction-safe approval with duplicate check & stock deduction
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch sale
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!sale) {
        throw new AppError('Sale not found.', 404, 'SALE_NOT_FOUND');
      }

      // 2. Concurrency / Duplicate Approval Prevention
      if (sale.status !== SaleStatus.PENDING) {
        throw new AppError(
          `Cannot approve sale: Status is already ${sale.status}.`,
          409,
          'SALE_NOT_PENDING'
        );
      }

      // 3. Verify product availability and stock
      for (const item of sale.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new AppError(`Product with ID "${item.productId}" no longer exists.`, 404, 'PRODUCT_NOT_FOUND');
        }

        if (product.quantity < item.quantity) {
          throw new AppError(
            `Insufficient stock for "${product.name}" (SKU: ${product.sku}). Available: ${product.quantity}, Required: ${item.quantity}.`,
            400,
            'INSUFFICIENT_STOCK'
          );
        }

        // Decrement stock
        const qtyBefore = product.quantity;
        const qtyAfter = qtyBefore - item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: qtyAfter },
        });

        // Create immutable negative stock movement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.SALE_DEDUCTION,
            quantityBefore: qtyBefore,
            quantityChange: -item.quantity,
            quantityAfter: qtyAfter,
            referenceType: 'SALE',
            referenceId: sale.id,
            reason: `Deducted upon sale approval (#${sale.referenceNumber}) and cash handover confirmation`,
            performedById: approverId,
          },
        });
      }

      // 4. Update Sale status to APPROVED
      const approvedSale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.APPROVED,
          approvedById: approverId,
          approvedAt: new Date(),
        },
        include: {
          salesOfficer: {
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
            },
          },
        },
      });

      // 5. Audit log
      await logAudit(
        {
          actorId: approverId,
          action: 'SALE_APPROVED',
          entityType: 'Sale',
          entityId: id,
          metadata: {
            referenceNumber: approvedSale.referenceNumber,
            totalAmount: Number(approvedSale.totalAmount),
            salesOfficerId: approvedSale.salesOfficerId,
          },
        },
        tx
      );

      return {
        ...approvedSale,
        totalAmount: Number(approvedSale.totalAmount),
        items: approvedSale.items.map((i) => ({
          ...i,
          unitPrice: Number(i.unitPrice),
          lineTotal: Number(i.lineTotal),
        })),
      };
    });
  }

  static async rejectSale(rejectorId: string, id: string, reason: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
    });

    if (!sale) {
      throw new AppError('Sale not found.', 404, 'SALE_NOT_FOUND');
    }

    if (sale.status !== SaleStatus.PENDING) {
      throw new AppError(
        `Cannot reject sale: Status is already ${sale.status}.`,
        409,
        'SALE_NOT_PENDING'
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
        salesOfficer: {
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
          },
        },
      },
    });

    await logAudit({
      actorId: rejectorId,
      action: 'SALE_REJECTED',
      entityType: 'Sale',
      entityId: id,
      metadata: {
        referenceNumber: sale.referenceNumber,
        reason,
        salesOfficerId: sale.salesOfficerId,
      },
    });

    return {
      ...rejectedSale,
      totalAmount: Number(rejectedSale.totalAmount),
      items: rejectedSale.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
    };
  }
}
