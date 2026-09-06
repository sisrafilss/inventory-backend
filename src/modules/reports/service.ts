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
    query: { startDate?: string; endDate?: string },
    userRole: Role,
  ) {
    if (userRole === Role.MANAGER) {
      throw new Error("FORBIDDEN_BALANCE_SHEET");
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      dateFilter.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const hasDate = query.startDate || query.endDate;

    // 1. Completed Sales & COGS
    const sales = await prisma.sale.findMany({
      where: {
        status: SaleStatus.COMPLETED,
        ...(hasDate ? { createdAt: dateFilter } : {}),
      },
      include: {
        items: true,
      },
    });

    let totalRevenue = 0;
    let costOfGoodsSold = 0;

    for (const sale of sales) {
      totalRevenue += Number(sale.totalAmount);
      for (const item of sale.items) {
        costOfGoodsSold += Number(item.purchaseCost || 0) * item.quantity;
      }
    }

    const grossProfit = totalRevenue - costOfGoodsSold;

    // 2. Expenses / Daily Costs
    const expenses = await prisma.expense.findMany({
      where: hasDate ? { date: dateFilter } : {},
    });

    const totalExpenses = expenses.reduce(
      (acc, e) => acc + Number(e.amount),
      0,
    );

    const netOperatingIncome = grossProfit - totalExpenses;

    // 3. Customer Receivables & Supplier Payables (Current Outstanding)
    const [customers, suppliers, products] = await Promise.all([
      prisma.customer.findMany({ select: { currentDue: true } }),
      prisma.supplier.findMany({ select: { currentDue: true } }),
      prisma.product.findMany({ select: { quantity: true, costPrice: true } }),
    ]);

    const accountsReceivable = customers.reduce(
      (acc, c) => acc + Number(c.currentDue),
      0,
    );
    const accountsPayable = suppliers.reduce(
      (acc, s) => acc + Number(s.currentDue),
      0,
    );

    // 4. Inventory Valuation
    const inventoryValuation = products.reduce((acc, p) => {
      const qty = Math.max(0, p.quantity);
      return acc + qty * Number(p.costPrice);
    }, 0);

    return {
      revenue: totalRevenue,
      cogs: costOfGoodsSold,
      grossProfit,
      operatingExpenses: totalExpenses,
      netOperatingIncome,
      accountsReceivable,
      accountsPayable,
      inventoryValuation,
      netWorkingCapital:
        accountsReceivable + inventoryValuation - accountsPayable,
    };
  }
}
