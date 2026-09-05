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

    // 1. Fetch products to get current selling prices, cost prices, and stock
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
      if (prod.quantity < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${prod.name}" (SKU: ${prod.sku}). Available: ${prod.quantity}, Required: ${item.quantity}.`,
          400,
          "INSUFFICIENT_STOCK",
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

    // 3. Atomically create sale in COMPLETED status and deduct inventory immediately
    return await prisma.$transaction(
      async (tx) => {
        // Create Sale
        const sale = await tx.sale.create({
          data: {
            referenceNumber,
            createdById,
            customerId: data.customerId || null,
            warehouseId: data.warehouseId || null,
            paymentType,
            status: SaleStatus.COMPLETED,
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

        // Deduct inventory for each item
        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product || product.quantity < item.quantity) {
            throw new AppError(
              `Insufficient stock for item "${item.productId}".`,
              400,
              "INSUFFICIENT_STOCK",
            );
          }

          const qtyBefore = product.quantity;
          const qtyAfter = qtyBefore - item.quantity;

          // Global product stock decrement
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: qtyAfter },
          });

          // Warehouse stock decrement if warehouse assigned
          const targetWarehouseId = item.warehouseId || data.warehouseId;
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

          // Immutable StockMovement audit record
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: StockMovementType.SALE_DEDUCTION,
              quantityBefore: qtyBefore,
              quantityChange: -item.quantity,
              quantityAfter: qtyAfter,
              referenceType: "SALE",
              referenceId: sale.id,
              reason: `Deducted on sale #${sale.referenceNumber}`,
              performedById: createdById,
            },
          });
        }

        // Increment Customer current dues if outstanding credit
        if (data.customerId && dueAmount > 0) {
          await tx.customer.update({
            where: { id: data.customerId },
            data: {
              currentDue: { increment: dueAmount },
            },
          });
        }

        // Audit log
        await logAudit(
          {
            actorId: createdById,
            action: "SALE_CREATED",
            entityType: "Sale",
            entityId: sale.id,
            metadata: {
              referenceNumber: sale.referenceNumber,
              totalAmount,
              paymentType,
              paidAmount,
              dueAmount,
              itemCount: sale.items.length,
            },
          },
          tx,
        );

        return this.formatSaleResponse(sale);
      },
      { maxWait: 10000, timeout: 30000 },
    );
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
        {
          customer: {
            name: { contains: s, mode: "insensitive" },
          },
        },
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
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unit: true,
                  sellingPrice: true,
                  costPrice: requestUser.role !== Role.MANAGER,
                  company: { select: { id: true, name: true } },
                },
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
}
