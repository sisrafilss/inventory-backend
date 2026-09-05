import { prisma } from "../../config/db.js";
import { Role, SaleStatus } from "@prisma/client";

export class DashboardService {
  static async getSummary(user: { id: string; role: Role }) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      1,
    );

    // Admin, Super Admin, Manager Dashboard
    const [
      productsCount,
      categoriesCount,
      allActiveProducts,
      pendingSalesCount,
      todayApprovedSales,
      monthApprovedSales,
      recentSales,
      recentAdjustments,
      pendingSalesQueue,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: true } }),
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          quantity: true,
          costPrice: true,
          sellingPrice: true,
          reorderLevel: true,
        },
      }),
      prisma.sale.count({ where: { status: SaleStatus.PENDING } }),
      prisma.sale.findMany({
        where: {
          status: SaleStatus.APPROVED,
          approvedAt: { gte: todayStart },
        },
        select: { totalAmount: true },
      }),
      prisma.sale.findMany({
        where: {
          status: SaleStatus.APPROVED,
          approvedAt: { gte: monthStart },
        },
        select: { totalAmount: true },
      }),
      prisma.sale.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.stockMovement.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          performedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.sale.findMany({
        where: { status: SaleStatus.PENDING },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
            },
          },
        },
      }),
    ]);

    let totalQuantity = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of allActiveProducts) {
      totalQuantity += p.quantity;
      totalCostValue += p.quantity * Number(p.costPrice);
      totalRetailValue += p.quantity * Number(p.sellingPrice);
      if (p.quantity <= 0) {
        outOfStockCount++;
      } else if (p.quantity <= p.reorderLevel) {
        lowStockCount++;
      }
    }

    const todaySalesAmount = todayApprovedSales.reduce(
      (sum, s) => sum + Number(s.totalAmount),
      0,
    );
    const monthSalesAmount = monthApprovedSales.reduce(
      (sum, s) => sum + Number(s.totalAmount),
      0,
    );

    return {
      role: user.role,
      stats: {
        productsCount,
        categoriesCount,
        inventoryQuantity: totalQuantity,
        inventoryCostValue: totalCostValue.toFixed(2),
        inventoryRetailValue: totalRetailValue.toFixed(2),
        lowStockCount,
        outOfStockCount,
        pendingSalesCount,
        todayApprovedCount: todayApprovedSales.length,
        todaySalesAmount: todaySalesAmount.toFixed(2),
        monthSalesAmount: monthSalesAmount.toFixed(2),
      },
      recentSales: recentSales.map((s) => ({
        ...s,
        totalAmount: Number(s.totalAmount),
      })),
      recentAdjustments,
      pendingSalesQueue: pendingSalesQueue.map((s) => ({
        ...s,
        totalAmount: Number(s.totalAmount),
      })),
    };
  }
}
