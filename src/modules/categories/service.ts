import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { Prisma } from "@prisma/client";

export class CategoriesService {
  static async listCategories(query: { search?: string; isActive?: boolean }) {
    const where: Prisma.CategoryWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search && query.search.trim()) {
      where.name = { contains: query.search.trim(), mode: "insensitive" };
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return categories;
  }

  static async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new AppError("Category not found.", 404, "CATEGORY_NOT_FOUND");
    }

    return category;
  }

  static async createCategory(
    actorId: string,
    data: { name: string; description?: string; isActive?: boolean },
  ) {
    const existing = await prisma.category.findUnique({
      where: { name: data.name.trim() },
    });

    if (existing) {
      throw new AppError(
        "A category with this name already exists.",
        409,
        "CATEGORY_EXISTS",
      );
    }

    const category = await prisma.category.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim(),
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    await logAudit({
      actorId,
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: category.id,
      metadata: { name: category.name },
    });

    return category;
  }

  static async updateCategory(
    actorId: string,
    id: string,
    data: { name?: string; description?: string; isActive?: boolean },
  ) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new AppError("Category not found.", 404, "CATEGORY_NOT_FOUND");
    }

    if (data.name && data.name.trim() !== category.name) {
      const existing = await prisma.category.findUnique({
        where: { name: data.name.trim() },
      });
      if (existing) {
        throw new AppError(
          "A category with this name already exists.",
          409,
          "CATEGORY_EXISTS",
        );
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() || null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    await logAudit({
      actorId,
      action: "CATEGORY_UPDATED",
      entityType: "Category",
      entityId: id,
      metadata: data,
    });

    return updated;
  }
}
