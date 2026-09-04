import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { Prisma, StockMovementType } from "@prisma/client";

export class ProductsService {
  static async listProducts(query: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    isActive?: boolean;
    stockStatus?: "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    if (query.stockStatus === "OUT_OF_STOCK") {
      where.quantity = { lte: 0 };
    }

    const [total, products] = await Promise.all([
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

    // Format products with stockStatus
    const items = products.map((p) => {
      let stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
      if (p.quantity <= 0) {
        stockStatus = "OUT_OF_STOCK";
      } else if (p.quantity <= p.reorderLevel) {
        stockStatus = "LOW_STOCK";
      }

      return {
        ...p,
        costPrice: Number(p.costPrice),
        sellingPrice: Number(p.sellingPrice),
        stockStatus,
      };
    });

    // If stockStatus was LOW_STOCK, filter in memory if needed
    const filteredItems =
      query.stockStatus === "LOW_STOCK"
        ? items.filter((i) => i.stockStatus === "LOW_STOCK")
        : query.stockStatus === "IN_STOCK"
          ? items.filter((i) => i.stockStatus === "IN_STOCK")
          : items;

    return {
      products: filteredItems,
      meta: {
        page,
        limit,
        total:
          query.stockStatus && query.stockStatus !== "ALL"
            ? filteredItems.length
            : total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (!product) {
      throw new AppError("Product not found.", 404, "PRODUCT_NOT_FOUND");
    }

    let stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
    if (product.quantity <= 0) {
      stockStatus = "OUT_OF_STOCK";
    } else if (product.quantity <= product.reorderLevel) {
      stockStatus = "LOW_STOCK";
    }

    return {
      ...product,
      costPrice: Number(product.costPrice),
      sellingPrice: Number(product.sellingPrice),
      stockStatus,
    };
  }

  static async createProduct(
    actorId: string,
    data: {
      name: string;
      sku: string;
      categoryId: string;
      unit: string;
      costPrice: number;
      sellingPrice: number;
      quantity?: number;
      reorderLevel?: number;
      description?: string;
      isActive?: boolean;
    },
  ) {
    const sku = data.sku.trim().toUpperCase();

    const existingSku = await prisma.product.findUnique({
      where: { sku },
    });

    if (existingSku) {
      throw new AppError(
        `A product with SKU "${sku}" already exists.`,
        409,
        "SKU_EXISTS",
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new AppError(
        "The specified category does not exist.",
        404,
        "CATEGORY_NOT_FOUND",
      );
    }

    if (!category.isActive) {
      throw new AppError(
        "Cannot create a product in an inactive category.",
        400,
        "CATEGORY_INACTIVE",
      );
    }

    const initialQty = data.quantity || 0;

    // Use transaction to create product and optional initial stock movement
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: data.name.trim(),
          sku,
          categoryId: data.categoryId,
          unit: data.unit.trim().toLowerCase(),
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          quantity: initialQty,
          reorderLevel:
            data.reorderLevel !== undefined ? data.reorderLevel : 10,
          description: data.description?.trim(),
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });

      if (initialQty > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            type: StockMovementType.OPENING_STOCK,
            quantityBefore: 0,
            quantityChange: initialQty,
            quantityAfter: initialQty,
            reason: "Opening stock on product creation",
            performedById: actorId,
          },
        });
      }

      await logAudit(
        {
          actorId,
          action: "PRODUCT_CREATED",
          entityType: "Product",
          entityId: created.id,
          metadata: {
            name: created.name,
            sku: created.sku,
            initialQuantity: initialQty,
          },
        },
        tx,
      );

      return created;
    });

    return {
      ...product,
      costPrice: Number(product.costPrice),
      sellingPrice: Number(product.sellingPrice),
    };
  }

  static async updateProduct(
    actorId: string,
    id: string,
    data: {
      name?: string;
      sku?: string;
      categoryId?: string;
      unit?: string;
      costPrice?: number;
      sellingPrice?: number;
      reorderLevel?: number;
      description?: string;
      isActive?: boolean;
    },
  ) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError("Product not found.", 404, "PRODUCT_NOT_FOUND");
    }

    if (data.sku) {
      const sku = data.sku.trim().toUpperCase();
      if (sku !== product.sku) {
        const existing = await prisma.product.findUnique({ where: { sku } });
        if (existing) {
          throw new AppError(
            `A product with SKU "${sku}" already exists.`,
            409,
            "SKU_EXISTS",
          );
        }
      }
    }

    if (data.categoryId && data.categoryId !== product.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        throw new AppError(
          "The specified category does not exist.",
          404,
          "CATEGORY_NOT_FOUND",
        );
      }
      if (!category.isActive) {
        throw new AppError(
          "Cannot assign product to an inactive category.",
          400,
          "CATEGORY_INACTIVE",
        );
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.sku ? { sku: data.sku.trim().toUpperCase() } : {}),
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.unit ? { unit: data.unit.trim().toLowerCase() } : {}),
        ...(data.costPrice !== undefined ? { costPrice: data.costPrice } : {}),
        ...(data.sellingPrice !== undefined
          ? { sellingPrice: data.sellingPrice }
          : {}),
        ...(data.reorderLevel !== undefined
          ? { reorderLevel: data.reorderLevel }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() || null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    await logAudit({
      actorId,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: id,
      metadata: data,
    });

    return {
      ...updated,
      costPrice: Number(updated.costPrice),
      sellingPrice: Number(updated.sellingPrice),
    };
  }
}
