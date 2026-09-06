import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { StockMovementType, Prisma } from "@prisma/client";

export class InventoryService {
  static async adjustStock(
    actorId: string,
    data: {
      productId: string;
      type: StockMovementType;
      quantity: number;
      reason: string;
    },
  ) {
    const rawQty = Math.abs(data.quantity);
    let delta = 0;

    switch (data.type) {
      case StockMovementType.RESTOCK:
      case StockMovementType.RETURN:
      case StockMovementType.OPENING_STOCK:
        delta = rawQty;
        break;
      case StockMovementType.DAMAGE:
      case StockMovementType.LOSS:
        delta = -rawQty;
        break;
      case StockMovementType.CORRECTION:
      case StockMovementType.OTHER:
        delta = data.quantity; // signed quantity permitted
        break;
      default:
        throw new AppError(
          "Invalid adjustment type.",
          400,
          "INVALID_ADJUSTMENT_TYPE",
        );
    }

    // Execute adjustment inside a transaction with row locking
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) {
        throw new AppError("Product not found.", 404, "PRODUCT_NOT_FOUND");
      }

      const qtyBefore = product.quantity;
      const qtyAfter = qtyBefore + delta;

      if (qtyAfter < 0) {
        throw new AppError(
          `Adjustment failed: Cannot reduce stock below zero. Current stock is ${qtyBefore}, attempted change is ${delta}.`,
          400,
          "INSUFFICIENT_STOCK",
        );
      }

      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: { quantity: qtyAfter },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          type: data.type,
          quantityBefore: qtyBefore,
          quantityChange: delta,
          quantityAfter: qtyAfter,
          referenceType: "MANUAL_ADJUSTMENT",
          reason: data.reason.trim(),
          performedById: actorId,
        },
        include: {
          performedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      await logAudit(
        {
          actorId,
          action: "STOCK_ADJUSTED",
          entityType: "Product",
          entityId: data.productId,
          metadata: {
            productName: product.name,
            sku: product.sku,
            type: data.type,
            quantityBefore: qtyBefore,
            quantityChange: delta,
            quantityAfter: qtyAfter,
            reason: data.reason,
          },
        },
        tx,
      );

      return {
        product: {
          ...updatedProduct,
          costPrice: Number(updatedProduct.costPrice),
          sellingPrice: Number(updatedProduct.sellingPrice),
        },
        movement,
      };
    }, { maxWait: 10000, timeout: 30000 });

    return result;
  }

  static async listStockMovements(query: {
    page?: number;
    limit?: number;
    productId?: string;
    performedById?: string;
    type?: StockMovementType;
    startDate?: string;
    endDate?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.performedById) {
      where.performedById = query.performedById;
    }

    if (query.type) {
      where.type = query.type;
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

    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: { id: true, name: true, sku: true, unit: true },
          },
          performedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    return {
      movements,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getInventoryOverview(query?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
  }) {
    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (query?.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { sku: { contains: s, mode: "insensitive" } },
        { barcode: { contains: s, mode: "insensitive" } },
      ];
    }

    const [totalProducts, outOfStockCount, aggregates, totalFiltered, products] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, quantity: { lte: 0 } } }),
      prisma.$queryRaw<Array<{
        totalQuantity: number | bigint | null;
        totalCostValue: number | null;
        totalRetailValue: number | null;
        lowStockCount: number | bigint | null;
      }>>`
        SELECT 
          COALESCE(SUM(quantity), 0) AS "totalQuantity",
          COALESCE(SUM(quantity * "costPrice"), 0) AS "totalCostValue",
          COALESCE(SUM(quantity * "sellingPrice"), 0) AS "totalRetailValue",
          COUNT(CASE WHEN quantity > 0 AND quantity <= "reorderLevel" THEN 1 END) AS "lowStockCount"
        FROM "Product"
        WHERE "isActive" = true
      `,
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    const agg = aggregates[0] || {
      totalQuantity: 0,
      totalCostValue: 0,
      totalRetailValue: 0,
      lowStockCount: 0,
    };

    const formattedProducts = products.map((p) => {
      const qty = p.quantity;
      const cost = Number(p.costPrice);
      const selling = Number(p.sellingPrice);

      let stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
      if (qty <= 0) {
        stockStatus = "OUT_OF_STOCK";
      } else if (qty <= p.reorderLevel) {
        stockStatus = "LOW_STOCK";
      }

      return {
        ...p,
        costPrice: cost,
        sellingPrice: selling,
        stockStatus,
        inventoryValue: (qty * cost).toFixed(2),
      };
    });

    return {
      summary: {
        totalProducts,
        totalQuantity: Number(agg.totalQuantity || 0),
        totalCostValue: Number(agg.totalCostValue || 0).toFixed(2),
        totalRetailValue: Number(agg.totalRetailValue || 0).toFixed(2),
        lowStockCount: Number(agg.lowStockCount || 0),
        outOfStockCount,
      },
      products: formattedProducts,
      meta: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit),
      },
    };
  }
}
