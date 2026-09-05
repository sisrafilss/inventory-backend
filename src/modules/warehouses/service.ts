import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { Prisma } from "@prisma/client";

export class WarehousesService {
  static async listWarehouses(query: { search?: string; isActive?: boolean }) {
    const where: Prisma.WarehouseWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search && query.search.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: "insensitive" } },
        { code: { contains: query.search.trim(), mode: "insensitive" } },
      ];
    }

    return prisma.warehouse.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { stocks: true },
        },
      },
    });
  }

  static async getWarehouseById(id: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        stocks: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                sellingPrice: true,
              },
            },
          },
        },
      },
    });

    if (!warehouse) {
      throw new AppError("Warehouse not found.", 404, "WAREHOUSE_NOT_FOUND");
    }

    return warehouse;
  }

  static async createWarehouse(
    actorId: string,
    data: {
      name: string;
      code?: string;
      address?: string;
      isDefault?: boolean;
      isActive?: boolean;
    },
  ) {
    const existing = await prisma.warehouse.findUnique({
      where: { name: data.name.trim() },
    });
    if (existing) {
      throw new AppError(
        "A warehouse with this name already exists.",
        409,
        "WAREHOUSE_EXISTS",
      );
    }

    if (data.code && data.code.trim()) {
      const existingCode = await prisma.warehouse.findUnique({
        where: { code: data.code.trim() },
      });
      if (existingCode) {
        throw new AppError(
          "A warehouse with this code already exists.",
          409,
          "WAREHOUSE_CODE_EXISTS",
        );
      }
    }

    // If marked as default, unset other defaults
    if (data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: data.name.trim(),
        code: data.code ? data.code.trim() : null,
        address: data.address ? data.address.trim() : null,
        isDefault: data.isDefault || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    await logAudit({
      actorId,
      action: "WAREHOUSE_CREATED",
      entityType: "Warehouse",
      entityId: warehouse.id,
      metadata: { name: warehouse.name, code: warehouse.code },
    });

    return warehouse;
  }

  static async updateWarehouse(
    actorId: string,
    id: string,
    data: {
      name?: string;
      code?: string;
      address?: string | null;
      isDefault?: boolean;
      isActive?: boolean;
    },
  ) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new AppError("Warehouse not found.", 404, "WAREHOUSE_NOT_FOUND");
    }

    if (data.name && data.name.trim() !== warehouse.name) {
      const existing = await prisma.warehouse.findUnique({
        where: { name: data.name.trim() },
      });
      if (existing) {
        throw new AppError(
          "A warehouse with this name already exists.",
          409,
          "WAREHOUSE_EXISTS",
        );
      }
    }

    if (data.code && data.code.trim() !== warehouse.code) {
      const existingCode = await prisma.warehouse.findUnique({
        where: { code: data.code.trim() },
      });
      if (existingCode) {
        throw new AppError(
          "A warehouse with this code already exists.",
          409,
          "WAREHOUSE_CODE_EXISTS",
        );
      }
    }

    if (data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.code !== undefined && { code: data.code ? data.code.trim() : null }),
        ...(data.address !== undefined && { address: data.address ? data.address.trim() : null }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await logAudit({
      actorId,
      action: "WAREHOUSE_UPDATED",
      entityType: "Warehouse",
      entityId: updated.id,
      metadata: { previous: warehouse, updated },
    });

    return updated;
  }

  static async transferStock(
    actorId: string,
    data: {
      sourceWarehouseId: string;
      targetWarehouseId: string;
      productId: string;
      quantity: number;
      note?: string;
    },
  ) {
    if (data.sourceWarehouseId === data.targetWarehouseId) {
      throw new AppError(
        "Source and target warehouses must be different.",
        400,
        "INVALID_TRANSFER",
      );
    }

    return prisma.$transaction(
      async (tx) => {
        const sourceStock = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: data.sourceWarehouseId,
              productId: data.productId,
            },
          },
        });

        if (!sourceStock || sourceStock.quantity < data.quantity) {
          throw new AppError(
            `Insufficient stock in source warehouse. Available: ${sourceStock ? sourceStock.quantity : 0}`,
            400,
            "INSUFFICIENT_STOCK",
          );
        }

        // Deduct from source
        await tx.warehouseStock.update({
          where: { id: sourceStock.id },
          data: { quantity: sourceStock.quantity - data.quantity },
        });

        // Add to target
        await tx.warehouseStock.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: data.targetWarehouseId,
              productId: data.productId,
            },
          },
          update: { quantity: { increment: data.quantity } },
          create: {
            warehouseId: data.targetWarehouseId,
            productId: data.productId,
            quantity: data.quantity,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: "WAREHOUSE_STOCK_TRANSFER",
            entityType: "WarehouseStock",
            entityId: data.productId,
            metadata: {
              sourceWarehouseId: data.sourceWarehouseId,
              targetWarehouseId: data.targetWarehouseId,
              quantity: data.quantity,
              note: data.note,
            },
          },
        });

        return { message: "Stock transferred successfully." };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }
}
