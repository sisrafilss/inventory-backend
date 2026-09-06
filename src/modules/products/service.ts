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

    if ((query as any).companyId) {
      where.companyId = (query as any).companyId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
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
          company: {
            select: { id: true, name: true, code: true },
          },
          warehouseStocks: {
            include: {
              warehouse: {
                select: { id: true, name: true },
              },
            },
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
        dpRate: Number(p.dpRate),
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
        company: {
          select: { id: true, name: true, code: true, isActive: true },
        },
        warehouseStocks: {
          include: {
            warehouse: {
              select: { id: true, name: true, isDefault: true },
            },
          },
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
      dpRate: Number(product.dpRate),
      commissionPercent: Number(product.commissionPercent || 0),
      sellingPrice: Number(product.sellingPrice),
      stockStatus,
    };
  }

  static async getProductByCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new AppError("Product code is required.", 400, "INVALID_CODE");
    }

    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: { equals: trimmed, mode: "insensitive" } },
          { barcode: trimmed },
        ],
      },
      include: {
        category: {
          select: { id: true, name: true, isActive: true },
        },
        company: {
          select: { id: true, name: true, code: true, isActive: true },
        },
        warehouseStocks: {
          include: {
            warehouse: {
              select: { id: true, name: true, isDefault: true },
            },
          },
        },
      },
    });

    if (!product) {
      throw new AppError(`Product with code "${trimmed}" not found.`, 404, "PRODUCT_NOT_FOUND");
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
      dpRate: Number(product.dpRate),
      commissionPercent: Number(product.commissionPercent || 0),
      sellingPrice: Number(product.sellingPrice),
      stockStatus,
    };
  }

  static async updateSaleRate(
    actorId: string,
    data: { code?: string; id?: string; saleRate: number },
  ) {
    let product = null;

    if (data.id) {
      product = await prisma.product.findUnique({ where: { id: data.id } });
    } else if (data.code) {
      const trimmed = data.code.trim();
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { sku: { equals: trimmed, mode: "insensitive" } },
            { barcode: trimmed },
          ],
        },
      });
    }

    if (!product) {
      throw new AppError("Product not found to update sale rate.", 404, "PRODUCT_NOT_FOUND");
    }

    const prevSaleRate = Number(product.sellingPrice);
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { sellingPrice: data.saleRate },
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      actorId,
      action: "UPDATE_SALE_RATE",
      entityType: "Product",
      entityId: product.id,
      metadata: {
        productSku: product.sku,
        productName: product.name,
        previousSaleRate: prevSaleRate,
        newSaleRate: data.saleRate,
      },
    });

    return {
      ...updated,
      costPrice: Number(updated.costPrice),
      dpRate: Number(updated.dpRate),
      commissionPercent: Number(updated.commissionPercent || 0),
      sellingPrice: Number(updated.sellingPrice),
    };
  }

  static async createProduct(
    actorId: string,
    data: {
      name: string;
      sku: string;
      barcode?: string | null;
      categoryId?: string | null;
      companyId?: string | null;
      unit?: string;
      dpRate?: number;
      commissionPercent?: number;
      costPrice?: number;
      sellingPrice?: number;
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

    if (data.barcode && data.barcode.trim()) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: data.barcode.trim() },
      });
      if (existingBarcode) {
        throw new AppError(
          `A product with Barcode "${data.barcode.trim()}" already exists.`,
          409,
          "BARCODE_EXISTS",
        );
      }
    }

    if (data.categoryId) {
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
    }

    if (data.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: data.companyId },
      });
      if (!company) {
        throw new AppError("The specified company does not exist.", 404, "COMPANY_NOT_FOUND");
      }
    }

    const initialQty = data.quantity || 0;

    // Use transaction to create product, initial warehouse stock, and stock movement
    const product = await prisma.$transaction(async (tx) => {
      const defaultWarehouse = await tx.warehouse.findFirst({
        where: { isDefault: true, isActive: true },
      }) || await tx.warehouse.findFirst({ where: { isActive: true } });

      const created = await tx.product.create({
        data: {
          name: data.name.trim(),
          sku,
          barcode: data.barcode && data.barcode.trim() ? data.barcode.trim() : null,
          categoryId: data.categoryId || null,
          companyId: data.companyId || null,
          unit: data.unit ? data.unit.trim() : "Pieces",
          dpRate: data.dpRate || 0,
          commissionPercent: data.commissionPercent || 0,
          costPrice: data.costPrice || 0,
          sellingPrice: data.sellingPrice || 0,
          quantity: initialQty,
          reorderLevel:
            data.reorderLevel !== undefined ? data.reorderLevel : 10,
          description: data.description?.trim() || "None",
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });

      if (initialQty > 0) {
        if (defaultWarehouse) {
          await tx.warehouseStock.create({
            data: {
              warehouseId: defaultWarehouse.id,
              productId: created.id,
              quantity: initialQty,
            },
          });
        }

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
            barcode: created.barcode,
            companyId: created.companyId,
            initialQuantity: initialQty,
          },
        },
        tx,
      );

      return created;
    }, { maxWait: 10000, timeout: 30000 });

    return {
      ...product,
      costPrice: Number(product.costPrice),
      dpRate: Number(product.dpRate),
      sellingPrice: Number(product.sellingPrice),
    };
  }

  static async updateProduct(
    actorId: string,
    id: string,
    data: {
      name?: string;
      sku?: string;
      barcode?: string | null;
      categoryId?: string;
      companyId?: string | null;
      unit?: string;
      dpRate?: number;
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

    if (data.barcode && data.barcode.trim() !== product.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: data.barcode.trim() },
      });
      if (existingBarcode) {
        throw new AppError(
          `A product with Barcode "${data.barcode.trim()}" already exists.`,
          409,
          "BARCODE_EXISTS",
        );
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

    if (data.companyId && data.companyId !== product.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: data.companyId },
      });
      if (!company) {
        throw new AppError("The specified company does not exist.", 404, "COMPANY_NOT_FOUND");
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.sku ? { sku: data.sku.trim().toUpperCase() } : {}),
        ...(data.barcode !== undefined ? { barcode: data.barcode ? data.barcode.trim() : null } : {}),
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.companyId !== undefined ? { companyId: data.companyId || null } : {}),
        ...(data.unit ? { unit: data.unit.trim().toLowerCase() } : {}),
        ...(data.dpRate !== undefined ? { dpRate: data.dpRate } : {}),
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
      dpRate: Number(updated.dpRate),
      sellingPrice: Number(updated.sellingPrice),
    };
  }
}
