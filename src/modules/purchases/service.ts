import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { Prisma, StockMovementType } from "@prisma/client";

export interface CreatePurchaseItemInput {
  productId: string;
  warehouseId?: string;
  quantity: number;
  dpRate: number;
  commissionPercent: number;
  purchaseRate: number;
}

export interface CreatePurchaseInput {
  invoiceNumber?: string;
  supplierId?: string | null;
  supplierName?: string;
  paymentType: "CASH" | "SUPPLIER";
  paidAmount?: number;
  items: CreatePurchaseItemInput[];
  note?: string;
  warehouseId?: string;
}

export class PurchasesService {
  private static generateInvoiceNumber(): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PUR-${dateStr}-${rand}`;
  }

  static async createPurchase(actorId: string, input: CreatePurchaseInput) {
    if (!input.items || input.items.length === 0) {
      throw new AppError(
        "Purchase must contain at least one item.",
        400,
        "EMPTY_ITEMS",
      );
    }

    const invoiceNumber =
      input.invoiceNumber && input.invoiceNumber.trim()
        ? input.invoiceNumber.trim()
        : this.generateInvoiceNumber();

    const existingPurchase = await prisma.purchase.findUnique({
      where: { invoiceNumber },
    });
    if (existingPurchase) {
      throw new AppError(
        `Invoice number "${invoiceNumber}" already exists.`,
        409,
        "INVOICE_EXISTS",
      );
    }

    return prisma.$transaction(
      async (tx) => {
        // Resolve default warehouse if not explicitly passed
        let defaultWarehouse = input.warehouseId
          ? await tx.warehouse.findUnique({ where: { id: input.warehouseId } })
          : await tx.warehouse.findFirst({
              where: { isDefault: true, isActive: true },
            });

        if (!defaultWarehouse) {
          defaultWarehouse = await tx.warehouse.findFirst({
            where: { isActive: true },
          });
        }

        // Validate supplier if provided
        let resolvedSupplierName = input.supplierName;
        if (input.supplierId) {
          const supplier = await tx.supplier.findUnique({
            where: { id: input.supplierId },
          });
          if (!supplier) {
            throw new AppError(
              "Supplier not found.",
              404,
              "SUPPLIER_NOT_FOUND",
            );
          }
          resolvedSupplierName = supplier.name;
        } else if (input.paymentType === "SUPPLIER") {
          throw new AppError(
            "A supplier must be selected for credit purchases.",
            400,
            "SUPPLIER_REQUIRED_FOR_CREDIT",
          );
        }

        // Calculate line totals and grand total
        let totalAmount = 0;
        const itemCreates = [];

        for (const item of input.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new AppError(
              `Product not found (ID: ${item.productId})`,
              404,
              "PRODUCT_NOT_FOUND",
            );
          }

          const lineTotal = Number(
            (item.quantity * item.purchaseRate).toFixed(2),
          );
          totalAmount += lineTotal;

          const targetWarehouseId =
            item.warehouseId || defaultWarehouse?.id || null;

          itemCreates.push({
            productId: item.productId,
            warehouseId: targetWarehouseId,
            quantity: item.quantity,
            dpRate: item.dpRate,
            commissionPercent: item.commissionPercent,
            purchaseRate: item.purchaseRate,
            lineTotal,
          });

          // 1. Increment product master total quantity & update cost price and rates
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: { increment: item.quantity },
              costPrice: item.purchaseRate,
              dpRate: item.dpRate > 0 ? item.dpRate : undefined,
              commissionPercent:
                item.commissionPercent > 0 ? item.commissionPercent : undefined,
            },
          });

          // 2. Increment warehouse stock if warehouse exists
          if (targetWarehouseId) {
            await tx.warehouseStock.upsert({
              where: {
                warehouseId_productId: {
                  warehouseId: targetWarehouseId,
                  productId: item.productId,
                },
              },
              update: { quantity: { increment: item.quantity } },
              create: {
                warehouseId: targetWarehouseId,
                productId: item.productId,
                quantity: item.quantity,
              },
            });
          }

          // 3. Record StockMovement
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: StockMovementType.RESTOCK,
              quantityBefore: product.quantity,
              quantityChange: item.quantity,
              quantityAfter: product.quantity + item.quantity,
              reason: `Purchase receipt (#${invoiceNumber})`,
              referenceType: "Purchase",
              performedById: actorId,
            },
          });
        }

        totalAmount = Number(totalAmount.toFixed(2));
        const paidAmount =
          input.paymentType === "CASH"
            ? totalAmount
            : Number(Math.min(input.paidAmount || 0, totalAmount).toFixed(2));
        const dueAmount = Number(
          Math.max(0, totalAmount - paidAmount).toFixed(2),
        );

        // If credit purchase and due > 0, update supplier currentDue
        if (input.supplierId && dueAmount > 0) {
          await tx.supplier.update({
            where: { id: input.supplierId },
            data: { currentDue: { increment: dueAmount } },
          });
        }

        const purchase = await tx.purchase.create({
          data: {
            invoiceNumber,
            supplierId: input.supplierId || null,
            supplierName: resolvedSupplierName || null,
            paymentType: input.paymentType,
            totalAmount,
            paidAmount,
            dueAmount,
            note: input.note || null,
            createdById: actorId,
            items: {
              create: itemCreates,
            },
          },
          include: {
            supplier: true,
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true, unit: true },
                },
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: "PURCHASE_CREATED",
            entityType: "Purchase",
            entityId: purchase.id,
            metadata: {
              invoiceNumber: purchase.invoiceNumber,
              totalAmount,
              paidAmount,
              dueAmount,
              supplierName: resolvedSupplierName,
            },
          },
        });

        return purchase;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  static async listPurchases(query: {
    page?: number;
    limit?: number;
    supplierId?: string;
    paymentType?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseWhereInput = {};

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.paymentType) {
      where.paymentType = query.paymentType;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          supplier: {
            select: { id: true, name: true, companyName: true, phone: true },
          },
          createdBy: {
            select: { id: true, name: true, role: true },
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
      prisma.purchase.count({ where }),
    ]);

    return {
      purchases,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPurchaseById(id: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: {
          select: { id: true, name: true, role: true },
        },
        items: {
          include: {
            product: true,
            warehouse: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new AppError(
        "Purchase record not found.",
        404,
        "PURCHASE_NOT_FOUND",
      );
    }

    return purchase;
  }
}
