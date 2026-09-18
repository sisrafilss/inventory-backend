import { prisma } from "../../config/db.js";
import { SaleStatus, StockMovementType, Prisma, Role } from "@prisma/client";

export class ReportsService {
  static async getSalesReport(query: {
    startDate?: string;
    endDate?: string;
    createdById?: string;
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

    if (query.createdById) {
      where.createdById = query.createdById;
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
          createdBy: { select: { id: true, name: true, email: true } },
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
      createdByName: s.createdBy.name,
      createdByEmail: s.createdBy.email,
      totalAmount: Number(s.totalAmount),
      status: s.status,
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
      const qty = Number(p.quantity);
      const cost = Number(p.costPrice);
      const selling = Number(p.sellingPrice);
      const reorderLevel = Number(p.reorderLevel);

      let stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
      if (qty <= 0) {
        stockStatus = "OUT_OF_STOCK";
      } else if (qty <= reorderLevel) {
        stockStatus = "LOW_STOCK";
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name || "General",
        unit: p.unit,
        currentQuantity: qty,
        reorderLevel,
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
      status: SaleStatus.COMPLETED,
    };

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
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const formatted = sales.map((s) => ({
      saleId: s.id,
      referenceNumber: s.referenceNumber,
      amount: Number(s.totalAmount),
      createdByName: s.createdBy.name,
      createdByEmail: s.createdBy.email,
      confirmedBy: s.createdBy.name,
      confirmedAt: s.createdAt,
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

  static async getDueList(query: {
    type?: "ALL" | "CUSTOMER" | "SUPPLIER";
    search?: string;
    srGroup?: string;
  }) {
    const type = query.type || "ALL";
    const s = query.search?.trim();
    const srGroup = query.srGroup?.trim();

    // Collect distinct SR groups from customerSrDue and customer.srGroup
    const duesSrs = await prisma.customerSrDue.findMany({
      select: { srName: true },
      distinct: ["srName"],
    });
    const custSrs = await prisma.customer.findMany({
      where: { srGroup: { not: null } },
      select: { srGroup: true },
      distinct: ["srGroup"],
    });
    const srSet = new Set<string>();
    duesSrs.forEach((d) => d.srName && srSet.add(d.srName.trim()));
    custSrs.forEach((c) => c.srGroup && srSet.add(c.srGroup!.trim()));
    const srGroups = Array.from(srSet).sort();

    let customerDues: any[] = [];
    let suppliers: any[] = [];

    if (type === "ALL" || type === "CUSTOMER") {
      if (srGroup && srGroup !== "ALL") {
        // Filter specifically by this SR Group
        const specificSrDues = await prisma.customerSrDue.findMany({
          where: {
            srName: { equals: srGroup, mode: "insensitive" },
            currentDue: { gt: 0 },
            ...(s
              ? {
                  customer: {
                    OR: [
                      { name: { contains: s, mode: "insensitive" } },
                      { phone: { contains: s, mode: "insensitive" } },
                      { companyName: { contains: s, mode: "insensitive" } },
                    ],
                  },
                }
              : {}),
          },
          include: { customer: true },
          orderBy: { currentDue: "desc" },
        });

        const matchedCustIds = new Set(specificSrDues.map((d) => d.customerId));

        // Also check if any Customer has srGroup directly matching without separate CustomerSrDue
        const directCusts = await prisma.customer.findMany({
          where: {
            id: { notIn: Array.from(matchedCustIds) },
            srGroup: { equals: srGroup, mode: "insensitive" },
            currentDue: { gt: 0 },
            ...(s
              ? {
                  OR: [
                    { name: { contains: s, mode: "insensitive" } },
                    { phone: { contains: s, mode: "insensitive" } },
                    { companyName: { contains: s, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
        });

        customerDues = [
          ...specificSrDues.map((d) => ({
            id: d.customer.id,
            customerId: d.customer.id,
            name: d.customer.name,
            companyName: d.customer.companyName,
            phone: d.customer.phone,
            srGroup: d.srName,
            dueAmount: Number(d.currentDue),
            currentDue: Number(d.currentDue),
          })),
          ...directCusts.map((c) => ({
            id: c.id,
            customerId: c.id,
            name: c.name,
            companyName: c.companyName,
            phone: c.phone,
            srGroup: c.srGroup,
            dueAmount: Number(c.currentDue),
            currentDue: Number(c.currentDue),
          })),
        ].sort((a, b) => b.dueAmount - a.dueAmount);
      } else {
        // All SRs: list customers with dues, including their SR breakdown
        const customerWhere: Prisma.CustomerWhereInput = {
          currentDue: { gt: 0 },
        };
        if (s) {
          customerWhere.OR = [
            { name: { contains: s, mode: "insensitive" } },
            { phone: { contains: s, mode: "insensitive" } },
            { companyName: { contains: s, mode: "insensitive" } },
            { srGroup: { contains: s, mode: "insensitive" } },
          ];
        }
        const customers = await prisma.customer.findMany({
          where: customerWhere,
          include: {
            srDues: {
              where: { currentDue: { gt: 0 } },
            },
          },
          orderBy: { currentDue: "desc" },
        });

        customerDues = customers.map((c) => {
          const srBreakdown = c.srDues.map((d) => ({
            srName: d.srName,
            dueAmount: Number(d.currentDue),
          }));
          const srLabel =
            c.srGroup ||
            (c.srDues.length > 0
              ? c.srDues.map((d) => d.srName).join(", ")
              : "General");

          return {
            id: c.id,
            customerId: c.id,
            name: c.name,
            companyName: c.companyName,
            phone: c.phone,
            srGroup: srLabel,
            dueAmount: Number(c.currentDue),
            currentDue: Number(c.currentDue),
            srDues: srBreakdown,
          };
        });
      }
    }

    if (type === "ALL" || type === "SUPPLIER") {
      const supplierWhere: Prisma.SupplierWhereInput = {
        currentDue: { gt: 0 },
      };
      if (s) {
        supplierWhere.OR = [
          { name: { contains: s, mode: "insensitive" } },
          { phone: { contains: s, mode: "insensitive" } },
          { companyName: { contains: s, mode: "insensitive" } },
        ];
      }
      suppliers = await prisma.supplier.findMany({
        where: supplierWhere,
        orderBy: { currentDue: "desc" },
      });
    }

    const totalCustomerDue = customerDues.reduce(
      (acc, c) => acc + Number(c.dueAmount || c.currentDue || 0),
      0,
    );
    const totalSupplierDue = suppliers.reduce(
      (acc, s) => acc + Number(s.currentDue),
      0,
    );

    return {
      type,
      selectedSrGroup: srGroup || "ALL",
      srGroups,
      totalCustomerDue,
      totalSupplierDue,
      netBalance: totalCustomerDue - totalSupplierDue, // positive means receivables > payables
      customerDues,
      customers: customerDues,
      suppliers: suppliers.map((s) => ({
        ...s,
        currentDue: Number(s.currentDue),
      })),
    };
  }

  static async getProfitByInvoice(invoiceNumber: string, userRole: Role) {
    if (userRole === Role.MANAGER) {
      throw new Error("FORBIDDEN_PROFIT_ACCESS");
    }

    const sale = await prisma.sale.findFirst({
      where: {
        OR: [{ referenceNumber: invoiceNumber }, { id: invoiceNumber }],
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, dpRate: true },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new Error("INVOICE_NOT_FOUND");
    }

    let totalCost = 0;
    let totalSelling = 0;

    const items = sale.items.map((item) => {
      const unitCost = Number(item.purchaseCost || 0);
      const unitPrice = Number(item.unitPrice);
      const lineCost = unitCost * Number(item.quantity);
      const lineTotal = Number(item.lineTotal);
      const lineProfit = lineTotal - lineCost;
      const profitMargin = lineTotal > 0 ? (lineProfit / lineTotal) * 100 : 0;

      totalCost += lineCost;
      totalSelling += lineTotal;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unitCost,
        unitPrice,
        lineCost,
        lineTotal,
        lineProfit,
        profitMargin: Number(profitMargin.toFixed(2)),
      };
    });

    const netProfit = totalSelling - totalCost;
    const overallMargin =
      totalSelling > 0 ? (netProfit / totalSelling) * 100 : 0;

    return {
      invoiceNumber: sale.referenceNumber,
      saleId: sale.id,
      date: sale.createdAt,
      status: sale.status,
      customerName:
        sale.customer?.name || sale.customerName || "Walk-in Customer",
      customerPhone: sale.customer?.phone || sale.customerPhone || null,
      totalCost,
      totalSelling,
      netProfit,
      overallMargin: Number(overallMargin.toFixed(2)),
      items,
    };
  }

  static async getWarehouseStock(query?: {
    warehouseId?: string;
    companyId?: string;
  }) {
    const warehouses = await prisma.warehouse.findMany({
      where: query?.warehouseId ? { id: query.warehouseId } : undefined,
      include: {
        stocks: {
          include: {
            product: {
              include: {
                company: { select: { id: true, name: true } },
                category: { select: { id: true, name: true } },
                warehouseStocks: {
                  include: {
                    warehouse: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const report = warehouses.map((wh) => {
      let filteredStocks = (wh.stocks || []).filter((s) => Boolean(s?.product));
      if (query?.companyId) {
        filteredStocks = filteredStocks.filter(
          (s) => s.product?.companyId === query.companyId,
        );
      }

      const totalQuantity = filteredStocks.reduce(
        (acc, s) => acc + Number(s.quantity),
        0,
      );
      const totalCostValue = filteredStocks.reduce(
        (acc, s) => acc + Number(s.quantity) * Number(s.product.costPrice || 0),
        0,
      );
      const totalRetailValue = filteredStocks.reduce(
        (acc, s) =>
          acc + Number(s.quantity) * Number(s.product.sellingPrice || 0),
        0,
      );
      const potentialMargin = totalRetailValue - totalCostValue;

      let inStockCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const items = filteredStocks.map((s) => {
        const qty = Number(s.quantity);
        const cost = Number(s.product.costPrice || 0);
        const selling = Number(s.product.sellingPrice || 0);
        const reorder = Number(s.product.reorderLevel || 0);

        let stockStatus = "IN_STOCK";
        if (qty <= 0) {
          stockStatus = "OUT_OF_STOCK";
          outOfStockCount++;
        } else if (qty <= reorder) {
          stockStatus = "LOW_STOCK";
          lowStockCount++;
        } else {
          inStockCount++;
        }

        const costVal = qty * cost;
        const retailVal = qty * selling;

        return {
          id: s.id,
          productId: s.productId,
          productName: s.product.name,
          sku: s.product.sku,
          barcode: s.product.barcode,
          unit: s.product.unit,
          packSize: Number(s.product.packSize) || 1,
          companyId: s.product.companyId,
          company: s.product.company?.name || "N/A",
          categoryId: s.product.categoryId,
          category: s.product.category?.name || "N/A",
          quantity: qty,
          reorderLevel: reorder,
          dpRate: Number(s.product.dpRate || 0),
          commissionPercent: Number(s.product.commissionPercent || 0),
          costPrice: cost,
          sellingPrice: selling,
          totalCostValue: costVal,
          totalRetailValue: retailVal,
          stockStatus,
          isActive: s.product.isActive,
          description: s.product.description,
          product: {
            ...s.product,
            quantity: Number(s.product.quantity),
            costPrice: cost,
            sellingPrice: selling,
            reorderLevel: reorder,
            packSize: Number(s.product.packSize) || 1,
            dpRate: Number(s.product.dpRate || 0),
            commissionPercent: Number(s.product.commissionPercent || 0),
            warehouseStocks: s.product.warehouseStocks.map((ws) => ({
              id: ws.id,
              warehouseId: ws.warehouseId,
              quantity: Number(ws.quantity),
              warehouse: ws.warehouse,
            })),
          },
        };
      });

      return {
        warehouseId: wh.id,
        warehouseName: wh.name,
        location: wh.address,
        address: wh.address,
        isDefault: wh.isDefault,
        totalItemsTracked: items.length,
        inStockItems: inStockCount,
        lowStockItems: lowStockCount,
        outOfStockItems: outOfStockCount,
        totalQuantity,
        totalCostValue,
        totalRetailValue,
        potentialMargin,
        marginPercent:
          totalRetailValue > 0
            ? ((potentialMargin / totalRetailValue) * 100).toFixed(1)
            : "0.0",
        stocks: items,
      };
    });

    return report;
  }

  static async getDailySalesStatement(
    query: {
      date?: string;
      warehouseId?: string;
      page?: number;
      limit?: number;
    },
    userRole: Role,
  ) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const targetDate = query.date ? new Date(query.date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const where: Prisma.SaleWhereInput = {
      createdAt: { gte: startOfDay, lte: endOfDay },
    };

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
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
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      }),
    ]);

    const isManager = userRole === Role.MANAGER;
    let dayTotalSales = 0;
    let dayTotalPaid = 0;
    let dayTotalDue = 0;
    let dayTotalCost = 0;

    const formatted = sales.map((s) => {
      const totalAmount = Number(s.totalAmount);
      const paidAmount = Number(s.paidAmount || 0);
      const dueAmount = Number(s.dueAmount || 0);

      dayTotalSales += totalAmount;
      dayTotalPaid += paidAmount;
      dayTotalDue += dueAmount;

      let saleCost = 0;
      const items = s.items.map((i) => {
        const pCost = Number(i.purchaseCost || 0);
        const lineCost = pCost * Number(i.quantity);
        saleCost += lineCost;

        return {
          productId: i.productId,
          productName: i.product.name,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          lineTotal: Number(i.lineTotal),
          ...(!isManager ? { unitCost: pCost, lineCost } : {}),
        };
      });

      dayTotalCost += saleCost;
      const profit = totalAmount - saleCost;

      return {
        id: s.id,
        referenceNumber: s.referenceNumber,
        date: s.createdAt,
        status: s.status,
        paymentType: s.paymentType,
        customerName: s.customer?.name || s.customerName || "Walk-in",
        warehouseName: s.warehouse?.name || null,
        createdByName: s.createdBy.name,
        totalAmount,
        paidAmount,
        dueAmount,
        itemCount: s.items.length,
        items,
        ...(!isManager
          ? {
              totalCost: saleCost,
              profit,
              profitMargin:
                totalAmount > 0
                  ? Number(((profit / totalAmount) * 100).toFixed(2))
                  : 0,
            }
          : {}),
      };
    });

    const dayProfit = dayTotalSales - dayTotalCost;

    return {
      date: startOfDay.toISOString().split("T")[0],
      summary: {
        totalSales: dayTotalSales,
        totalPaid: dayTotalPaid,
        totalDue: dayTotalDue,
        ...(!isManager
          ? {
              totalCost: dayTotalCost,
              totalProfit: dayProfit,
              margin:
                dayTotalSales > 0
                  ? Number(((dayProfit / dayTotalSales) * 100).toFixed(2))
                  : 0,
            }
          : {}),
      },
      sales: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getDailyPurchases(query: {
    startDate?: string;
    endDate?: string;
    supplierId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseWhereInput = {};

    if (query.supplierId) {
      where.supplierId = query.supplierId;
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

    const [total, purchases] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          supplier: {
            select: { id: true, name: true, companyName: true, phone: true },
          },
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      }),
    ]);

    const formatted = purchases.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoiceNumber,
      date: p.createdAt,
      paymentType: p.paymentType,
      supplierName: p.supplier?.name || p.supplierName || "Direct / Cash",
      companyName: p.supplier?.companyName || null,
      createdByName: p.createdBy.name,
      totalAmount: Number(p.totalAmount),
      paidAmount: Number(p.paidAmount),
      dueAmount: Number(p.dueAmount),
      itemCount: p.items.length,
      items: p.items.map((i) => ({
        productName: i.product.name,
        quantity: i.quantity,
        dpRate: Number(i.dpRate),
        commissionPercent: Number(i.commissionPercent),
        purchaseRate: Number(i.purchaseRate),
        lineTotal: Number(i.lineTotal),
      })),
    }));

    const totalPurchasesAmount = formatted.reduce(
      (acc, p) => acc + p.totalAmount,
      0,
    );
    const totalPaidAmount = formatted.reduce((acc, p) => acc + p.paidAmount, 0);
    const totalDueAmount = formatted.reduce((acc, p) => acc + p.dueAmount, 0);

    return {
      summary: {
        totalPurchasesAmount,
        totalPaidAmount,
        totalDueAmount,
      },
      purchases: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getDailyCosts(query: {
    startDate?: string;
    endDate?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {};

    if (query.category && query.category !== "ALL") {
      where.category = query.category;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    const formatted = expenses.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: Number(e.amount),
      date: e.date,
      note: e.note,
      createdByName: e.createdBy.name,
    }));

    const totalExpenseAmount = formatted.reduce((acc, e) => acc + e.amount, 0);

    return {
      summary: {
        totalExpenseAmount,
      },
      expenses: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getBalanceSheet(
    query: {
      startDate?: string;
      endDate?: string;
      filterType?: string;
      warehouseId?: string;
    },
    userRole: Role,
  ) {
    const dateFilter: Prisma.DateTimeFilter = {};
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;

    if (query.startDate) {
      startDateTime = new Date(query.startDate);
      startDateTime.setHours(0, 0, 0, 0);
      dateFilter.gte = startDateTime;
    }
    if (query.endDate) {
      endDateTime = new Date(query.endDate);
      endDateTime.setHours(23, 59, 59, 999);
      dateFilter.lte = endDateTime;
    }

    const hasDate = Boolean(query.startDate || query.endDate);

    // 1. Completed Sales & COGS in date range
    const saleWhere: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
      ...(hasDate ? { createdAt: dateFilter } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };

    const [
      sales,
      purchases,
      expenses,
      storeSetting,
      allProducts,
      stockMovements,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere,
        include: {
          items: true,
        },
      }),
      prisma.purchase.findMany({
        where: {
          ...(hasDate ? { createdAt: dateFilter } : {}),
        },
        include: {
          items: true,
        },
      }),
      prisma.expense.findMany({
        where: hasDate ? { date: dateFilter } : {},
      }),
      prisma.storeSetting.findFirst(),
      prisma.product.findMany({
        select: {
          id: true,
          costPrice: true,
          quantity: true,
          warehouseStocks: query.warehouseId
            ? { where: { warehouseId: query.warehouseId } }
            : true,
        },
      }),
      // Fetch stock movements after startDateTime to calculate opening stock
      startDateTime
        ? prisma.stockMovement.findMany({
            where: {
              createdAt: { gte: startDateTime },
            },
            select: {
              productId: true,
              quantityChange: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    // 2. Aggregate Sales & COGS
    let totalSale = 0;
    let costOfGoodsSold = 0;
    for (const sale of sales) {
      totalSale += Number(sale.totalAmount);
      for (const item of sale.items) {
        costOfGoodsSold +=
          Number(item.purchaseCost || 0) * Number(item.quantity);
      }
    }

    // 3. Aggregate Purchases
    let totalPurchase = 0;
    for (const purchase of purchases) {
      totalPurchase += Number(purchase.totalAmount);
    }

    // 4. Aggregate Expenses
    const totalExpenses = expenses.reduce(
      (acc, e) => acc + Number(e.amount),
      0,
    );

    // 5. Present Stock (Closing stock valuation as of endDate)
    // Map current product stocks
    const productQtyMap = new Map<string, number>();
    for (const p of allProducts) {
      let qty = 0;
      if (query.warehouseId) {
        qty = p.warehouseStocks.reduce(
          (sum, ws) => sum + Number(ws.quantity),
          0,
        );
      } else {
        qty = Number(p.quantity);
      }
      productQtyMap.set(p.id, Math.max(0, qty));
    }

    // If endDate is in the past, unwind stock movements after endDate
    if (endDateTime && endDateTime < new Date()) {
      for (const sm of stockMovements) {
        if (sm.createdAt > endDateTime) {
          const cur = productQtyMap.get(sm.productId) || 0;
          productQtyMap.set(sm.productId, cur - Number(sm.quantityChange));
        }
      }
    }

    let presentStock = 0;
    for (const p of allProducts) {
      const q = Math.max(0, productQtyMap.get(p.id) || 0);
      presentStock += q * Number(p.costPrice);
    }

    // 6. Previous Stock (Opening stock valuation as of startDate)
    let previousStock = 0;
    if (!startDateTime) {
      // All time -> opening stock was 0
      previousStock = 0;
    } else {
      // Unwind all stock movements between startDate and now/endDate
      const startQtyMap = new Map(productQtyMap);
      for (const sm of stockMovements) {
        if (
          sm.createdAt >= startDateTime &&
          (!endDateTime || sm.createdAt <= endDateTime)
        ) {
          const cur = startQtyMap.get(sm.productId) || 0;
          startQtyMap.set(sm.productId, cur - Number(sm.quantityChange));
        }
      }
      for (const p of allProducts) {
        const q = Math.max(0, startQtyMap.get(p.id) || 0);
        previousStock += q * Number(p.costPrice);
      }
    }

    // Round to 2 decimals
    const round = (num: number) =>
      Math.round((num + Number.EPSILON) * 100) / 100;

    previousStock = round(previousStock);
    totalPurchase = round(totalPurchase);
    totalSale = round(totalSale);
    presentStock = round(presentStock);

    // 7. Balance Sheet Totals & Trading Result
    const debitTotal = round(previousStock + totalPurchase);
    const creditTotal = round(totalSale + presentStock);

    const diff = round(creditTotal - debitTotal);
    const isProfit = diff >= 0;
    const profit = isProfit ? diff : 0;
    const loss = !isProfit ? Math.abs(diff) : 0;
    const balancedTotal = Math.max(debitTotal, creditTotal);

    // 8. Account Receivables & Payables
    const [customers, suppliers] = await Promise.all([
      prisma.customer.findMany({ select: { currentDue: true } }),
      prisma.supplier.findMany({ select: { currentDue: true } }),
    ]);
    const accountsReceivable = round(
      customers.reduce((acc, c) => acc + Number(c.currentDue), 0),
    );
    const accountsPayable = round(
      suppliers.reduce((acc, s) => acc + Number(s.currentDue), 0),
    );

    const grossProfit = round(totalSale - costOfGoodsSold);
    const netOperatingIncome = round(grossProfit - totalExpenses);

    return {
      particulars: {
        previousStock,
        totalPurchase,
        totalSale,
        presentStock,
        debitTotal,
        creditTotal,
        profit,
        loss,
        isProfit,
        balancedTotal,
      },
      summary: {
        revenue: totalSale,
        cogs: round(costOfGoodsSold),
        grossProfit,
        operatingExpenses: round(totalExpenses),
        netOperatingIncome,
        accountsReceivable,
        accountsPayable,
        inventoryValuation: presentStock,
        netWorkingCapital: round(
          accountsReceivable + presentStock - accountsPayable,
        ),
        salesCount: sales.length,
        purchasesCount: purchases.length,
        expensesCount: expenses.length,
      },
      dateRange: {
        startDate: query.startDate || null,
        endDate: query.endDate || null,
        filterType: query.filterType || "Date Wise",
      },
      storeInfo: {
        storeName:
          storeSetting?.storeName || "M.R. Enterprise & Wholesale Trading",
        proprietor: storeSetting?.proprietor || "Haji Mohammad Israfil",
        phone: storeSetting?.phone || "+880 1711-234567",
        address:
          storeSetting?.address ||
          "Holding 14, Tejgaon Industrial Area, Dhaka-1208, Bangladesh",
        memoFooterNote:
          storeSetting?.memoFooterNote ||
          "ধন্যবাদ, আবার আসবেন! মাল বুঝে নিয়ে ক্যাশ মেমো চেক করুন।",
      },
    };
  }

  static async getDailyPurchaseOrSales(query: {
    type?: "SALES" | "PURCHASE" | "ALL";
    startDate?: string;
    endDate?: string;
    companyId?: string;
    categoryId?: string;
    search?: string;
  }) {
    const type = query.type || "SALES";

    let start: Date;
    let end: Date;

    if (query.startDate) {
      start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    }

    if (query.endDate) {
      end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    }

    const items: Array<{
      id: string;
      date: string;
      rawDate: Date;
      code: string;
      name: string;
      company: string;
      category: string;
      quantity: number;
      rate: number;
      amount: number;
      invoice: string;
      type: "SALES" | "PURCHASE";
      partyName: string;
    }> = [];

    const formatDate = (d: Date) => {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // 1. Fetch Sales items
    if (type === "SALES" || type === "ALL") {
      const saleItemWhere: Prisma.SaleItemWhereInput = {
        sale: {
          createdAt: { gte: start, lte: end },
        },
      };

      const productWhere: Prisma.ProductWhereInput = {};
      if (query.companyId) {
        productWhere.companyId = query.companyId;
      }
      if (query.categoryId) {
        productWhere.categoryId = query.categoryId;
      }
      if (query.companyId || query.categoryId) {
        saleItemWhere.product = productWhere;
      }

      if (query.search && query.search.trim()) {
        const s = query.search.trim();
        saleItemWhere.OR = [
          { product: { name: { contains: s, mode: "insensitive" } } },
          { product: { sku: { contains: s, mode: "insensitive" } } },
          { sale: { referenceNumber: { contains: s, mode: "insensitive" } } },
        ];
      }

      const saleItems = await prisma.saleItem.findMany({
        where: saleItemWhere,
        orderBy: { sale: { createdAt: "desc" } },
        include: {
          sale: {
            select: {
              referenceNumber: true,
              createdAt: true,
              customerName: true,
              customer: { select: { name: true } },
            },
          },
          product: {
            select: {
              name: true,
              sku: true,
              company: { select: { name: true } },
              category: { select: { name: true } },
            },
          },
        },
      });

      for (const item of saleItems) {
        const rate = Number(item.unitPrice);
        const amount = Number(item.lineTotal);
        items.push({
          id: item.id,
          date: formatDate(item.sale.createdAt),
          rawDate: item.sale.createdAt,
          code: item.product.sku,
          name: item.product.name,
          company: item.product.company?.name || "—",
          category: item.product.category?.name || "—",
          quantity: Number(item.quantity),
          rate,
          amount,
          invoice: item.sale.referenceNumber,
          type: "SALES",
          partyName:
            item.sale.customer?.name || item.sale.customerName || "Cash Party",
        });
      }
    }

    // 2. Fetch Purchase items
    if (type === "PURCHASE" || type === "ALL") {
      const purchaseItemWhere: Prisma.PurchaseItemWhereInput = {
        purchase: {
          createdAt: { gte: start, lte: end },
        },
      };

      const productWhere: Prisma.ProductWhereInput = {};
      if (query.companyId) {
        productWhere.companyId = query.companyId;
      }
      if (query.categoryId) {
        productWhere.categoryId = query.categoryId;
      }
      if (query.companyId || query.categoryId) {
        purchaseItemWhere.product = productWhere;
      }

      if (query.search && query.search.trim()) {
        const s = query.search.trim();
        purchaseItemWhere.OR = [
          { product: { name: { contains: s, mode: "insensitive" } } },
          { product: { sku: { contains: s, mode: "insensitive" } } },
          { purchase: { invoiceNumber: { contains: s, mode: "insensitive" } } },
        ];
      }

      const purchaseItems = await prisma.purchaseItem.findMany({
        where: purchaseItemWhere,
        orderBy: { purchase: { createdAt: "desc" } },
        include: {
          purchase: {
            select: {
              invoiceNumber: true,
              createdAt: true,
              supplier: { select: { name: true, companyName: true } },
            },
          },
          product: {
            select: {
              name: true,
              sku: true,
              company: { select: { name: true } },
              category: { select: { name: true } },
            },
          },
        },
      });

      for (const item of purchaseItems) {
        const rate = Number(item.purchaseRate || item.dpRate || 0);
        const amount = Number(item.lineTotal);
        items.push({
          id: item.id,
          date: formatDate(item.purchase.createdAt),
          rawDate: item.purchase.createdAt,
          code: item.product.sku,
          name: item.product.name,
          company: item.product.company?.name || "—",
          category: item.product.category?.name || "—",
          quantity: Number(item.quantity),
          rate,
          amount,
          invoice: item.purchase.invoiceNumber,
          type: "PURCHASE",
          partyName:
            item.purchase.supplier?.name ||
            item.purchase.supplier?.companyName ||
            "Cash Supplier",
        });
      }
    }

    // Sort items chronologically descending
    items.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

    const totalAmount = Number(
      items.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
    );
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    const storeSetting = await prisma.storeSetting.findFirst();

    return {
      type,
      startDate: formatDate(start),
      endDate: formatDate(end),
      totalAmount,
      totalQuantity,
      count: items.length,
      storeInfo: {
        storeName:
          storeSetting?.storeName || "M.R. Enterprise & Wholesale Trading",
        proprietor: storeSetting?.proprietor || "Haji Mohammad Israfil",
        phone: storeSetting?.phone || "+880 1711-234567",
        address:
          storeSetting?.address ||
          "Holding 14, Tejgaon Industrial Area, Dhaka-1208, Bangladesh",
      },
      items: items.map((item, index) => ({
        sn: index + 1,
        ...item,
      })),
    };
  }

  static async getBIAnalytics(query: {
    startDate?: string;
    endDate?: string;
    warehouseId?: string;
    categoryId?: string;
  }) {
    const whereSale: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
    };

    if (query.warehouseId) {
      whereSale.warehouseId = query.warehouseId;
    }

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

    const itemWhere: Prisma.SaleItemWhereInput = {};
    if (query.categoryId) {
      itemWhere.product = {
        categoryId: query.categoryId,
      };
    }

    const sales = await prisma.sale.findMany({
      where: whereSale,
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: { select: { name: true } },
        items: {
          where: itemWhere,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                company: { select: { name: true } },
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalUnitsSold = 0;
    let totalDiscount = 0;

    const dailyTrendMap = new Map<
      string,
      { revenue: number; cost: number; profit: number; salesCount: number }
    >();

    const categoryMap = new Map<
      string,
      {
        categoryName: string;
        revenue: number;
        cost: number;
        profit: number;
        itemsSold: number;
      }
    >();

    const productMap = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string;
        barcode: string | null;
        categoryName: string;
        unitsSold: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    >();

    const lineItems: any[] = [];

    for (const sale of sales) {
      const dateStr = sale.createdAt.toISOString().split("T")[0];
      const saleTot = Number(sale.totalAmount || 0);
      const saleDisc = Number(sale.discount || 0);
      const discountRatio = saleTot > 0 ? saleDisc / saleTot : 0;
      totalDiscount += saleDisc;

      for (const item of sale.items) {
        const qty = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const grossLineTotal = Number(item.lineTotal || qty * unitPrice);
        const lineDiscount = grossLineTotal * discountRatio;
        const netLineTotal = grossLineTotal - lineDiscount;

        const purchaseCostUnit = Number(item.purchaseCost || 0);
        const totalLineCost = qty * purchaseCostUnit;
        const lineProfit = netLineTotal - totalLineCost;

        totalRevenue += netLineTotal;
        totalCost += totalLineCost;
        totalUnitsSold += qty;

        // Daily trend aggregation
        const existingDaily = dailyTrendMap.get(dateStr) || {
          revenue: 0,
          cost: 0,
          profit: 0,
          salesCount: 0,
        };
        existingDaily.revenue += netLineTotal;
        existingDaily.cost += totalLineCost;
        existingDaily.profit += lineProfit;
        existingDaily.salesCount += 1;
        dailyTrendMap.set(dateStr, existingDaily);

        // Category breakdown aggregation
        const catName = item.product.category?.name || "Uncategorized";
        const existingCat = categoryMap.get(catName) || {
          categoryName: catName,
          revenue: 0,
          cost: 0,
          profit: 0,
          itemsSold: 0,
        };
        existingCat.revenue += netLineTotal;
        existingCat.cost += totalLineCost;
        existingCat.profit += lineProfit;
        existingCat.itemsSold += qty;
        categoryMap.set(catName, existingCat);

        // Product performance aggregation
        const prodId = item.product.id;
        const existingProd = productMap.get(prodId) || {
          id: prodId,
          name: item.product.name,
          sku: item.product.sku,
          barcode: item.product.barcode || null,
          categoryName: catName,
          unitsSold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
        existingProd.unitsSold += qty;
        existingProd.revenue += netLineTotal;
        existingProd.cost += totalLineCost;
        existingProd.profit += lineProfit;
        productMap.set(prodId, existingProd);

        // Flat Line item for custom report builder grid
        lineItems.push({
          id: item.id,
          saleId: sale.id,
          date: sale.createdAt.toISOString().split("T")[0],
          rawDate: sale.createdAt,
          invoiceNumber: sale.referenceNumber,
          customerName: sale.customerName || "Cash Retail Customer",
          warehouseName: sale.warehouse?.name || "Main Warehouse",
          productName: item.product.name,
          sku: item.product.sku,
          barcode: item.product.barcode || "—",
          companyName: item.product.company?.name || "—",
          categoryName: catName,
          quantity: qty,
          unitPrice,
          lineTotal: Number(netLineTotal.toFixed(2)),
          purchaseCost: purchaseCostUnit,
          totalCost: Number(totalLineCost.toFixed(2)),
          profit: Number(lineProfit.toFixed(2)),
          marginPercent:
            netLineTotal > 0
              ? Number(((lineProfit / netLineTotal) * 100).toFixed(1))
              : 0,
        });
      }
    }

    const netProfit = totalRevenue - totalCost;
    const overallMarginPercent =
      totalRevenue > 0
        ? Number(((netProfit / totalRevenue) * 100).toFixed(2))
        : 0;

    // Format daily trend sorted chronologically
    const dailyTrends = Array.from(dailyTrendMap.entries())
      .map(([date, d]) => ({
        date,
        revenue: Number(d.revenue.toFixed(2)),
        cost: Number(d.cost.toFixed(2)),
        profit: Number(d.profit.toFixed(2)),
        marginPercent:
          d.revenue > 0 ? Number(((d.profit / d.revenue) * 100).toFixed(1)) : 0,
        salesCount: d.salesCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format category profitability
    const categoryBreakdown = Array.from(categoryMap.values())
      .map((c) => ({
        ...c,
        revenue: Number(c.revenue.toFixed(2)),
        cost: Number(c.cost.toFixed(2)),
        profit: Number(c.profit.toFixed(2)),
        marginPercent:
          c.revenue > 0 ? Number(((c.profit / c.revenue) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.profit - a.profit);

    // Format top profit products (Top 10)
    const topProfitProducts = Array.from(productMap.values())
      .map((p) => ({
        ...p,
        revenue: Number(p.revenue.toFixed(2)),
        cost: Number(p.cost.toFixed(2)),
        profit: Number(p.profit.toFixed(2)),
        marginPercent:
          p.revenue > 0 ? Number(((p.profit / p.revenue) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    return {
      summary: {
        totalSalesCount: sales.length,
        totalUnitsSold,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        overallMarginPercent,
        totalDiscount: Number(totalDiscount.toFixed(2)),
      },
      dailyTrends,
      categoryBreakdown,
      topProfitProducts,
      lineItems: lineItems.map((item, idx) => ({
        sn: idx + 1,
        ...item,
      })),
    };
  }

  // Month-over-Month (MoM) Comparison Report
  static async getMoMComparison() {
    const now = new Date();

    // Current Month Range
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Previous Month Range
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    const [currentSales, prevSales] = await Promise.all([
      prisma.sale.findMany({
        where: {
          status: SaleStatus.COMPLETED,
          createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
        },
        include: { items: true },
      }),
      prisma.sale.findMany({
        where: {
          status: SaleStatus.COMPLETED,
          createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
        },
        include: { items: true },
      }),
    ]);

    const calculateMetrics = (salesList: typeof currentSales) => {
      let revenue = 0;
      let cost = 0;
      let units = 0;
      let discount = 0;

      for (const sale of salesList) {
        const saleTot = Number(sale.totalAmount || 0);
        const saleDisc = Number(sale.discount || 0);
        discount += saleDisc;
        const discountRatio = saleTot > 0 ? saleDisc / saleTot : 0;

        for (const item of sale.items) {
          const qty = Number(item.quantity);
          const price = Number(item.unitPrice);
          const gross = Number(item.lineTotal || qty * price);
          const net = gross - gross * discountRatio;
          const c = qty * Number(item.purchaseCost || 0);

          revenue += net;
          cost += c;
          units += qty;
        }
      }

      const profit = revenue - cost;
      const marginPercent =
        revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;

      return {
        salesCount: salesList.length,
        unitsSold: units,
        revenue: Number(revenue.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        profit: Number(profit.toFixed(2)),
        marginPercent,
        discount: Number(discount.toFixed(2)),
      };
    };

    const currentMonth = calculateMetrics(currentSales);
    const previousMonth = calculateMetrics(prevSales);

    const calculateGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(1));
    };

    const growth = {
      revenueGrowth: calculateGrowth(
        currentMonth.revenue,
        previousMonth.revenue,
      ),
      profitGrowth: calculateGrowth(currentMonth.profit, previousMonth.profit),
      salesCountGrowth: calculateGrowth(
        currentMonth.salesCount,
        previousMonth.salesCount,
      ),
      unitsSoldGrowth: calculateGrowth(
        currentMonth.unitsSold,
        previousMonth.unitsSold,
      ),
    };

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    return {
      currentMonthName: `${months[now.getMonth()]} ${now.getFullYear()}`,
      previousMonthName: `${months[prevMonthStart.getMonth()]} ${prevMonthStart.getFullYear()}`,
      currentMonth,
      previousMonth,
      growth,
    };
  }

  // Fast & Slow Moving Product Velocity Report
  static async getProductVelocity() {
    const days60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [products, recentSaleItems] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        include: {
          category: { select: { name: true } },
          company: { select: { name: true } },
        },
      }),
      prisma.saleItem.findMany({
        where: {
          sale: {
            status: SaleStatus.COMPLETED,
            createdAt: { gte: days60 },
          },
        },
        select: {
          productId: true,
          quantity: true,
          lineTotal: true,
        },
      }),
    ]);

    const salesMap = new Map<string, { qty: number; revenue: number }>();
    for (const item of recentSaleItems) {
      const existing = salesMap.get(item.productId) || { qty: 0, revenue: 0 };
      existing.qty += Number(item.quantity);
      existing.revenue += Number(item.lineTotal || 0);
      salesMap.set(item.productId, existing);
    }

    const items = products.map((p) => {
      const sales = salesMap.get(p.id) || { qty: 0, revenue: 0 };
      let categoryType:
        | "FAST_MOVING"
        | "MODERATE"
        | "SLOW_MOVING"
        | "DEAD_STOCK" = "DEAD_STOCK";

      if (sales.qty >= 40) {
        categoryType = "FAST_MOVING";
      } else if (sales.qty >= 10) {
        categoryType = "MODERATE";
      } else if (sales.qty > 0) {
        categoryType = "SLOW_MOVING";
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || "—",
        category: p.category?.name || "Uncategorized",
        company: p.company?.name || "—",
        currentStock: p.quantity,
        unit: p.unit,
        sellingPrice: Number(p.sellingPrice),
        costPrice: Number(p.costPrice || 0),
        unitsSold60Days: sales.qty,
        revenue60Days: Number(sales.revenue.toFixed(2)),
        velocityCategory: categoryType,
      };
    });

    items.sort((a, b) => b.unitsSold60Days - a.unitsSold60Days);

    return {
      summary: {
        totalProducts: items.length,
        fastMovingCount: items.filter(
          (i) => i.velocityCategory === "FAST_MOVING",
        ).length,
        moderateCount: items.filter((i) => i.velocityCategory === "MODERATE")
          .length,
        slowMovingCount: items.filter(
          (i) => i.velocityCategory === "SLOW_MOVING",
        ).length,
        deadStockCount: items.filter((i) => i.velocityCategory === "DEAD_STOCK")
          .length,
      },
      items,
    };
  }

  // Party / Customer Ledger Running Balance Statement
  static async getCustomerLedger(query: {
    customerId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const customer = await prisma.customer.findUnique({
      where: { id: query.customerId },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const whereDate: any = {};
    if (query.startDate) whereDate.gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      whereDate.lte = end;
    }

    const [sales, payments, returns] = await Promise.all([
      prisma.sale.findMany({
        where: {
          customerId: query.customerId,
          status: SaleStatus.COMPLETED,
          ...(Object.keys(whereDate).length > 0
            ? { createdAt: whereDate }
            : {}),
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.partyPayment.findMany({
        where: {
          customerId: query.customerId,
          ...(Object.keys(whereDate).length > 0
            ? { createdAt: whereDate }
            : {}),
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.salesReturn.findMany({
        where: {
          customerId: query.customerId,
          ...(Object.keys(whereDate).length > 0
            ? { createdAt: whereDate }
            : {}),
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const transactions: any[] = [];

    for (const sale of sales) {
      transactions.push({
        id: sale.id,
        date: sale.createdAt.toISOString().split("T")[0],
        rawDate: sale.createdAt,
        type: "SALE",
        reference: sale.referenceNumber,
        description: `Sale Invoice #${sale.referenceNumber} (${sale.paymentType})`,
        debit: Number(sale.netAmount), // Increases customer due
        credit: Number(sale.paidAmount), // Immediate paid amount
      });
    }

    for (const p of payments) {
      transactions.push({
        id: p.id,
        date: p.createdAt.toISOString().split("T")[0],
        rawDate: p.createdAt,
        type: "PAYMENT",
        reference: p.receiptNumber || p.id.slice(-6),
        description: `Payment Received (${p.paymentMethod || "CASH"}) - ${p.referenceNote || "Collection"}`,
        debit: 0,
        credit: Number(p.amount), // Reduces customer due
      });
    }

    for (const ret of returns) {
      transactions.push({
        id: ret.id,
        date: ret.createdAt.toISOString().split("T")[0],
        rawDate: ret.createdAt,
        type: "RETURN",
        reference: ret.returnNumber,
        description: `Sales Return #${ret.returnNumber} (${ret.refundType})`,
        debit: 0,
        credit: Number(ret.refundAmount || ret.totalAmount), // Reduces due or refunded
      });
    }

    transactions.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    let runningBalance = Number(customer.openingDue || 0);
    const ledgerEntries = transactions.map((t) => {
      runningBalance += t.debit - t.credit;
      return {
        ...t,
        balance: Number(runningBalance.toFixed(2)),
      };
    });

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        currentDue: Number(customer.currentDue),
        openingBalance: Number(customer.openingDue || 0),
      },
      startDate: query.startDate || "Beginning",
      endDate: query.endDate || "Present",
      ledgerEntries,
      finalBalance: Number(runningBalance.toFixed(2)),
    };
  }

  // Salesperson / User Wise Performance Report
  static async getUserPerformance(query: {
    startDate?: string;
    endDate?: string;
  }) {
    const where: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
    };

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const userMap = new Map<
      string,
      {
        userId: string;
        userName: string;
        userRole: string;
        salesCount: number;
        totalRevenue: number;
        totalCollected: number;
        totalDue: number;
      }
    >();

    for (const s of sales) {
      const uId = s.createdById || "SYSTEM";
      const uName = s.createdBy?.name || "System / Cashier";
      const uRole = s.createdBy?.role || "STAFF";

      const existing = userMap.get(uId) || {
        userId: uId,
        userName: uName,
        userRole: uRole,
        salesCount: 0,
        totalRevenue: 0,
        totalCollected: 0,
        totalDue: 0,
      };

      existing.salesCount += 1;
      existing.totalRevenue += Number(s.netAmount);
      existing.totalCollected += Number(s.paidAmount);
      existing.totalDue += Number(s.dueAmount || 0);

      userMap.set(uId, existing);
    }

    const users = Array.from(userMap.values()).map((u) => ({
      ...u,
      totalRevenue: Number(u.totalRevenue.toFixed(2)),
      totalCollected: Number(u.totalCollected.toFixed(2)),
      totalDue: Number(u.totalDue.toFixed(2)),
      avgOrderValue:
        u.salesCount > 0
          ? Number((u.totalRevenue / u.salesCount).toFixed(2))
          : 0,
    }));

    users.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      totalUsers: users.length,
      users,
    };
  }

  // Low Stock / Reorder Alert List
  static async getReorderAlerts() {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        company: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { quantity: "asc" },
    });

    const lowStockItems = products
      .filter((p) => Number(p.quantity) <= Number(p.reorderLevel))
      .map((p) => {
        const requiredQty = Math.max(
          1,
          Number(p.reorderLevel) * 2 - Number(p.quantity),
        );
        const totalEstimatedCost = requiredQty * Number(p.costPrice || 0);

        return {
          id: p.id,
          sku: p.sku,
          barcode: p.barcode || "—",
          name: p.name,
          company: p.company?.name || "—",
          category: p.category?.name || "Uncategorized",
          unit: p.unit,
          currentStock: Number(p.quantity),
          reorderLevel: Number(p.reorderLevel),
          suggestedReorderQty: requiredQty,
          costPrice: Number(p.costPrice || 0),
          totalEstimatedCost: Number(totalEstimatedCost.toFixed(2)),
          urgency: Number(p.quantity) <= 0 ? "CRITICAL" : "WARNING",
        };
      });

    const totalEstimatedCapitalNeeded = lowStockItems.reduce(
      (acc, i) => acc + i.totalEstimatedCost,
      0,
    );

    return {
      summary: {
        totalAlerts: lowStockItems.length,
        outOfStockCount: lowStockItems.filter(
          (i) => Number(i.currentStock) <= 0,
        ).length,
        lowStockCount: lowStockItems.filter((i) => Number(i.currentStock) > 0)
          .length,
        totalEstimatedCapitalNeeded: Number(
          totalEstimatedCapitalNeeded.toFixed(2),
        ),
      },
      items: lowStockItems,
    };
  }

  // Stock Aging Report
  static async getStockAging(query?: {
    asOfDate?: string;
    bracket?: string;
    minDays?: string | number;
    maxDays?: string | number;
    fromDate?: string;
    toDate?: string;
  }) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { name: true } },
        company: { select: { name: true } },
        saleItems: {
          orderBy: { sale: { createdAt: "desc" } },
          take: 1,
          select: { sale: { select: { createdAt: true } } },
        },
      },
    });

    const now =
      query?.asOfDate && !isNaN(new Date(query.asOfDate).getTime())
        ? new Date(query.asOfDate)
        : new Date();

    let items = products.map((p) => {
      const lastSaleDate = p.saleItems[0]?.sale?.createdAt || p.createdAt;
      const ageDays = Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(lastSaleDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );

      let ageBracket:
        | "0-30 Days"
        | "31-60 Days"
        | "61-90 Days"
        | "90+ Days (Dead Stock)" = "0-30 Days";

      if (ageDays > 90) {
        ageBracket = "90+ Days (Dead Stock)";
      } else if (ageDays > 60) {
        ageBracket = "61-90 Days";
      } else if (ageDays > 30) {
        ageBracket = "31-60 Days";
      }

      const totalValuation = Number(p.quantity) * Number(p.costPrice || 0);

      return {
        id: p.id,
        sku: p.sku,
        barcode: p.barcode || "—",
        name: p.name,
        company: p.company?.name || "—",
        category: p.category?.name || "Uncategorized",
        unit: p.unit,
        currentStock: Number(p.quantity),
        costPrice: Number(p.costPrice || 0),
        totalValuation: Number(totalValuation.toFixed(2)),
        lastSaleDate: new Date(lastSaleDate).toISOString().split("T")[0],
        ageDays,
        ageBracket,
      };
    });

    items.sort((a, b) => b.ageDays - a.ageDays);

    const summary = {
      bracket0_30: items.filter((i) => i.ageBracket === "0-30 Days").length,
      bracket31_60: items.filter((i) => i.ageBracket === "31-60 Days").length,
      bracket61_90: items.filter((i) => i.ageBracket === "61-90 Days").length,
      bracket90Plus: items.filter(
        (i) => i.ageBracket === "90+ Days (Dead Stock)",
      ).length,
      deadStockTiedCapital: items
        .filter((i) => i.ageBracket === "90+ Days (Dead Stock)")
        .reduce((acc, i) => acc + i.totalValuation, 0),
    };

    if (query?.bracket) {
      if (query.bracket === "0-30")
        items = items.filter((i) => i.ageBracket === "0-30 Days");
      else if (query.bracket === "31-60")
        items = items.filter((i) => i.ageBracket === "31-60 Days");
      else if (query.bracket === "61-90")
        items = items.filter((i) => i.ageBracket === "61-90 Days");
      else if (query.bracket === "90+")
        items = items.filter((i) => i.ageBracket === "90+ Days (Dead Stock)");
    }
    if (query?.minDays !== undefined && query?.minDays !== "") {
      items = items.filter((i) => i.ageDays >= Number(query.minDays));
    }
    if (query?.maxDays !== undefined && query?.maxDays !== "") {
      items = items.filter((i) => i.ageDays <= Number(query.maxDays));
    }
    if (query?.fromDate) {
      items = items.filter((i) => i.lastSaleDate >= String(query.fromDate));
    }
    if (query?.toDate) {
      items = items.filter((i) => i.lastSaleDate <= String(query.toDate));
    }

    return {
      summary: {
        ...summary,
        deadStockTiedCapital: Number(summary.deadStockTiedCapital.toFixed(2)),
      },
      items,
    };
  }
}
