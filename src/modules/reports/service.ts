import { prisma } from "../../config/db.js";
import { SaleStatus, StockMovementType, Role, Prisma } from "@prisma/client";

export class ReportsService {
  static async getSalesReport(query: {
    startDate?: string;
    endDate?: string;
    salesOfficerId?: string;
    status?: SaleStatus;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.salesOfficerId) {
      where.salesOfficerId = query.salesOfficerId;
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
          salesOfficer: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      }),
    ]);

    const formatted = sales.map((s) => ({
      saleId: s.id,
      referenceNumber: s.referenceNumber,
      date: s.createdAt,
      salesOfficer: s.salesOfficer.name,
      salesOfficerEmail: s.salesOfficer.email,
      totalAmount: Number(s.totalAmount),
      status: s.status,
      approvedBy: s.approvedBy?.name || null,
      approvedAt: s.approvedAt,
      itemsCount: s.items.length,
    }));

    return {
      report: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getInventoryReport(query: {
    categoryId?: string;
    stockStatus?: "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
    isActive?: boolean;
  }) {
    const where: Prisma.ProductWhereInput = {};

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    const report = products.map((p) => {
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
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        unit: p.unit,
        currentQuantity: qty,
        reorderLevel: p.reorderLevel,
        costPrice: cost,
        sellingPrice: selling,
        totalCostValue: (qty * cost).toFixed(2),
        totalRetailValue: (qty * selling).toFixed(2),
        stockStatus,
        isActive: p.isActive,
      };
    });

    const filtered =
      query.stockStatus && query.stockStatus !== "ALL"
        ? report.filter((r) => r.stockStatus === query.stockStatus)
        : report;

    return filtered;
  }

  static async getStockAdjustmentsReport(query: {
    startDate?: string;
    endDate?: string;
    productId?: string;
    type?: StockMovementType;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
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
          product: { select: { name: true, sku: true, unit: true } },
          performedBy: { select: { name: true, email: true, role: true } },
        },
      }),
    ]);

    const formatted = movements.map((m) => ({
      id: m.id,
      date: m.createdAt,
      product: m.product.name,
      sku: m.product.sku,
      unit: m.product.unit,
      type: m.type,
      quantityBefore: m.quantityBefore,
      quantityChange: m.quantityChange,
      quantityAfter: m.quantityAfter,
      performedBy: m.performedBy.name,
      userRole: m.performedBy.role,
      reason: m.reason,
      referenceType: m.referenceType,
    }));

    return {
      report: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSalesOfficersReport(query: {
    startDate?: string;
    endDate?: string;
  }) {
    const salesOfficers = await prisma.user.findMany({
      where: { role: Role.SALES_OFFICER },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    });

    const whereSale: Prisma.SaleWhereInput = {};
    if (query.startDate || query.endDate) {
      whereSale.createdAt = {};
      if (query.startDate) {
        whereSale.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        whereSale.createdAt.lte = end;
      }
    }

    const report = await Promise.all(
      salesOfficers.map(async (officer) => {
        const [totalSubmitted, approvedSales, rejectedSales] =
          await Promise.all([
            prisma.sale.count({
              where: { ...whereSale, salesOfficerId: officer.id },
            }),
            prisma.sale.findMany({
              where: {
                ...whereSale,
                salesOfficerId: officer.id,
                status: SaleStatus.APPROVED,
              },
              select: { totalAmount: true },
            }),
            prisma.sale.count({
              where: {
                ...whereSale,
                salesOfficerId: officer.id,
                status: SaleStatus.REJECTED,
              },
            }),
          ]);

        const totalApprovedAmount = approvedSales.reduce(
          (sum, s) => sum + Number(s.totalAmount),
          0,
        );

        return {
          id: officer.id,
          name: officer.name,
          email: officer.email,
          status: officer.status,
          totalSubmitted,
          approvedCount: approvedSales.length,
          rejectedCount: rejectedSales,
          pendingCount: totalSubmitted - approvedSales.length - rejectedSales,
          approvedSalesAmount: totalApprovedAmount.toFixed(2),
        };
      }),
    );

    return report;
  }

  static async getCashHandoverReport(query: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {
      status: SaleStatus.APPROVED,
    };

    if (query.startDate || query.endDate) {
      where.approvedAt = {};
      if (query.startDate) {
        where.approvedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.approvedAt.lte = end;
      }
    }

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { approvedAt: "desc" },
        include: {
          salesOfficer: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const formatted = sales.map((s) => ({
      saleId: s.id,
      referenceNumber: s.referenceNumber,
      amount: Number(s.totalAmount),
      salesOfficer: s.salesOfficer.name,
      salesOfficerEmail: s.salesOfficer.email,
      confirmedBy: s.approvedBy?.name || "Unknown",
      confirmedAt: s.approvedAt,
      customerName: s.customerName || "N/A",
    }));

    return {
      report: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
