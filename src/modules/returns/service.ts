import { PrismaClient, StockMovementType } from "@prisma/client";
import { AppError } from "../../errors/AppError.js";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

function generateReturnNumber(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${timestamp}-${random}`;
}

export class ReturnsService {
  // ==========================================
  // 1. SALES RETURNS (Customer Return)
  // ==========================================
  static async createSalesReturn(data: {
    saleId?: string | null;
    customerId?: string | null;
    warehouseId?: string | null;
    refundType: "CASH" | "CREDIT_ADJUSTMENT";
    refundAmount: number;
    reason?: string | null;
    items: { productId: string; quantity: number; unitPrice: number }[];
    userId: string;
  }) {
    if (!data.items || data.items.length === 0) {
      throw new AppError("Items are required for sales return", 400, "BAD_REQUEST");
    }

    const returnNumber = generateReturnNumber("SRET");
    let calculatedTotal = 0;
    const itemDataList = data.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      calculatedTotal += lineTotal;
      return {
        productId: item.productId,
        quantity: new Decimal(item.quantity),
        unitPrice: new Decimal(item.unitPrice),
        lineTotal: new Decimal(lineTotal),
      };
    });

    const finalRefundAmount = data.refundAmount > 0 ? data.refundAmount : calculatedTotal;

    return await prisma.$transaction(async (tx) => {
      // 1. Create SalesReturn record
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          saleId: data.saleId || null,
          customerId: data.customerId || null,
          warehouseId: data.warehouseId || null,
          totalAmount: new Decimal(calculatedTotal),
          refundAmount: new Decimal(finalRefundAmount),
          refundType: data.refundType,
          reason: data.reason || null,
          createdById: data.userId,
          items: {
            create: itemDataList,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
          warehouse: true,
          sale: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 2. Restock products & record stock movements
      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new AppError(`Product not found: ${item.productId}`, 404, "NOT_FOUND");
        }

        const qtyBefore = new Decimal(product.quantity);
        const qtyChange = new Decimal(item.quantity);
        const qtyAfter = qtyBefore.add(qtyChange);

        // Update overall product quantity
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: qtyAfter },
        });

        // Update warehouse stock if warehouseId provided
        if (data.warehouseId) {
          const whStock = await tx.warehouseStock.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: data.warehouseId,
                productId: item.productId,
              },
            },
          });

          if (whStock) {
            await tx.warehouseStock.update({
              where: { id: whStock.id },
              data: { quantity: new Decimal(whStock.quantity).add(qtyChange) },
            });
          } else {
            await tx.warehouseStock.create({
              data: {
                warehouseId: data.warehouseId,
                productId: item.productId,
                quantity: qtyChange,
              },
            });
          }
        }

        // Record StockMovement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: data.warehouseId || null,
            type: StockMovementType.SALES_RETURN,
            quantityBefore: qtyBefore,
            quantityChange: qtyChange,
            quantityAfter: qtyAfter,
            referenceType: "SALES_RETURN",
            referenceId: salesReturn.id,
            reason: data.reason || `Sales Return (${returnNumber})`,
            performedById: data.userId,
          },
        });
      }

      // 3. Adjust customer due if credit adjustment selected
      if (data.refundType === "CREDIT_ADJUSTMENT" && data.customerId && finalRefundAmount > 0) {
        const customer = await tx.customer.findUnique({
          where: { id: data.customerId },
        });

        if (customer) {
          const currentDue = new Decimal(customer.currentDue);
          const newDue = currentDue.sub(new Decimal(finalRefundAmount));
          const adjustedDue = newDue.isNegative() ? new Decimal(0) : newDue;

          await tx.customer.update({
            where: { id: data.customerId },
            data: { currentDue: adjustedDue },
          });
        }
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: data.userId,
          action: "CREATE_SALES_RETURN",
          entityType: "SalesReturn",
          entityId: salesReturn.id,
          metadata: {
            returnNumber,
            totalAmount: calculatedTotal,
            refundAmount: finalRefundAmount,
            refundType: data.refundType,
          },
        },
      });

      return salesReturn;
    });
  }

  static async listSalesReturns(query: {
    page?: number;
    limit?: number;
    search?: string;
    customerId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { returnNumber: { contains: query.search, mode: "insensitive" } },
        { reason: { contains: query.search, mode: "insensitive" } },
        { customer: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    if (query.customerId) where.customerId = query.customerId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      prisma.salesReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          warehouse: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
        },
      }),
      prisma.salesReturn.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSalesReturnById(id: string) {
    const record = await prisma.salesReturn.findUnique({
      where: { id },
      include: {
        customer: true,
        warehouse: true,
        sale: true,
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!record) {
      throw new AppError("Sales return record not found", 404, "NOT_FOUND");
    }

    return record;
  }

  // ==========================================
  // 2. PURCHASE RETURNS (Supplier Return)
  // ==========================================
  static async createPurchaseReturn(data: {
    purchaseId?: string | null;
    supplierId?: string | null;
    warehouseId?: string | null;
    refundType: "CASH" | "CREDIT_ADJUSTMENT";
    refundAmount: number;
    reason?: string | null;
    items: { productId: string; quantity: number; unitPrice: number }[];
    userId: string;
  }) {
    if (!data.items || data.items.length === 0) {
      throw new AppError("Items are required for purchase return", 400, "BAD_REQUEST");
    }

    const returnNumber = generateReturnNumber("PRET");
    let calculatedTotal = 0;
    const itemDataList = data.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      calculatedTotal += lineTotal;
      return {
        productId: item.productId,
        quantity: new Decimal(item.quantity),
        unitPrice: new Decimal(item.unitPrice),
        lineTotal: new Decimal(lineTotal),
      };
    });

    const finalRefundAmount = data.refundAmount > 0 ? data.refundAmount : calculatedTotal;

    return await prisma.$transaction(async (tx) => {
      // 1. Create PurchaseReturn record
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          purchaseId: data.purchaseId || null,
          supplierId: data.supplierId || null,
          warehouseId: data.warehouseId || null,
          totalAmount: new Decimal(calculatedTotal),
          refundAmount: new Decimal(finalRefundAmount),
          refundType: data.refundType,
          reason: data.reason || null,
          createdById: data.userId,
          items: {
            create: itemDataList,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          supplier: true,
          warehouse: true,
          purchase: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 2. Deduct stock from products & record stock movements
      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new AppError(`Product not found: ${item.productId}`, 404, "NOT_FOUND");
        }

        const qtyBefore = new Decimal(product.quantity);
        const qtyChange = new Decimal(item.quantity);
        const qtyAfter = qtyBefore.sub(qtyChange);

        // Update overall product quantity
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: qtyAfter },
        });

        // Update warehouse stock if warehouseId provided
        if (data.warehouseId) {
          const whStock = await tx.warehouseStock.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: data.warehouseId,
                productId: item.productId,
              },
            },
          });

          if (whStock) {
            const currentWhQty = new Decimal(whStock.quantity);
            await tx.warehouseStock.update({
              where: { id: whStock.id },
              data: { quantity: currentWhQty.sub(qtyChange) },
            });
          }
        }

        // Record StockMovement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: data.warehouseId || null,
            type: StockMovementType.PURCHASE_RETURN,
            quantityBefore: qtyBefore,
            quantityChange: new Decimal(-item.quantity),
            quantityAfter: qtyAfter,
            referenceType: "PURCHASE_RETURN",
            referenceId: purchaseReturn.id,
            reason: data.reason || `Purchase Return (${returnNumber})`,
            performedById: data.userId,
          },
        });
      }

      // 3. Adjust supplier due if credit adjustment selected
      if (data.refundType === "CREDIT_ADJUSTMENT" && data.supplierId && finalRefundAmount > 0) {
        const supplier = await tx.supplier.findUnique({
          where: { id: data.supplierId },
        });

        if (supplier) {
          const currentDue = new Decimal(supplier.currentDue);
          const newDue = currentDue.sub(new Decimal(finalRefundAmount));
          const adjustedDue = newDue.isNegative() ? new Decimal(0) : newDue;

          await tx.supplier.update({
            where: { id: data.supplierId },
            data: { currentDue: adjustedDue },
          });
        }
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: data.userId,
          action: "CREATE_PURCHASE_RETURN",
          entityType: "PurchaseReturn",
          entityId: purchaseReturn.id,
          metadata: {
            returnNumber,
            totalAmount: calculatedTotal,
            refundAmount: finalRefundAmount,
            refundType: data.refundType,
          },
        },
      });

      return purchaseReturn;
    });
  }

  static async listPurchaseReturns(query: {
    page?: number;
    limit?: number;
    search?: string;
    supplierId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { returnNumber: { contains: query.search, mode: "insensitive" } },
        { reason: { contains: query.search, mode: "insensitive" } },
        { supplier: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          warehouse: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
        },
      }),
      prisma.purchaseReturn.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPurchaseReturnById(id: string) {
    const record = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        purchase: true,
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!record) {
      throw new AppError("Purchase return record not found", 404, "NOT_FOUND");
    }

    return record;
  }
}
