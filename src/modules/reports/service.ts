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
        category: p.category?.name || "General",
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
  }) {
    const type = query.type || "ALL";
    const s = query.search?.trim();

    let customers: any[] = [];
    let suppliers: any[] = [];

    if (type === "ALL" || type === "CUSTOMER") {
      const customerWhere: Prisma.CustomerWhereInput = {
        currentDue: { gt: 0 },
      };
      if (s) {
        customerWhere.OR = [
          { name: { contains: s, mode: "insensitive" } },
          { phone: { contains: s, mode: "insensitive" } },
        ];
      }
      customers = await prisma.customer.findMany({
        where: customerWhere,
        orderBy: { currentDue: "desc" },
      });
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

    const totalCustomerDue = customers.reduce(
      (acc, c) => acc + Number(c.currentDue),
      0,
    );
    const totalSupplierDue = suppliers.reduce(
      (acc, s) => acc + Number(s.currentDue),
      0,
    );

    return {
      type,
      totalCustomerDue,
      totalSupplierDue,
      netBalance: totalCustomerDue - totalSupplierDue, // positive means receivables > payables
      customers: customers.map((c) => ({
        ...c,
        currentDue: Number(c.currentDue),
      })),
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
      const lineCost = unitCost * item.quantity;
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
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const report = warehouses.map((wh) => {
      let filteredStocks = wh.stocks;
      if (query?.companyId) {
        filteredStocks = filteredStocks.filter(
          (s) => s.product.companyId === query.companyId,
        );
      }

      return {
        warehouseId: wh.id,
        warehouseName: wh.name,
        location: wh.address,
        address: wh.address,
        isDefault: wh.isDefault,
        totalItemsTracked: filteredStocks.length,
        totalQuantity: filteredStocks.reduce((acc, s) => acc + s.quantity, 0),
        stocks: filteredStocks.map((s) => ({
          id: s.id,
          productId: s.productId,
          productName: s.product.name,
          sku: s.product.sku,
          unit: s.product.unit,
          company: s.product.company?.name || "N/A",
          category: s.product.category?.name || "N/A",
          quantity: s.quantity,
          sellingPrice: Number(s.product.sellingPrice),
        })),
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
        const lineCost = pCost * i.quantity;
        saleCost += lineCost;

        return {
          productId: i.productId,
          productName: i.product.name,
          quantity: i.quantity,
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
        costOfGoodsSold += Number(item.purchaseCost || 0) * item.quantity;
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
        qty = p.warehouseStocks.reduce((sum, ws) => sum + ws.quantity, 0);
      } else {
        qty = p.quantity;
      }
      productQtyMap.set(p.id, Math.max(0, qty));
    }

    // If endDate is in the past, unwind stock movements after endDate
    if (endDateTime && endDateTime < new Date()) {
      for (const sm of stockMovements) {
        if (sm.createdAt > endDateTime) {
          const cur = productQtyMap.get(sm.productId) || 0;
          productQtyMap.set(sm.productId, cur - sm.quantityChange);
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
          startQtyMap.set(sm.productId, cur - sm.quantityChange);
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
          quantity: item.quantity,
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
          quantity: item.quantity,
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
}
