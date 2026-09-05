import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { Prisma } from "@prisma/client";

export class CompaniesService {
  static async listCompanies(query: { search?: string; isActive?: boolean }) {
    const where: Prisma.CompanyWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search && query.search.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: "insensitive" } },
        { code: { contains: query.search.trim(), mode: "insensitive" } },
      ];
    }

    const companies = await prisma.company.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return companies;
  }

  static async getCompanyById(id: string) {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!company) {
      throw new AppError("Company not found.", 404, "COMPANY_NOT_FOUND");
    }

    return company;
  }

  static async createCompany(
    actorId: string,
    data: { name: string; code?: string; description?: string; isActive?: boolean },
  ) {
    const existing = await prisma.company.findUnique({
      where: { name: data.name.trim() },
    });

    if (existing) {
      throw new AppError(
        "A company with this name already exists.",
        409,
        "COMPANY_EXISTS",
      );
    }

    if (data.code && data.code.trim()) {
      const existingCode = await prisma.company.findUnique({
        where: { code: data.code.trim() },
      });
      if (existingCode) {
        throw new AppError(
          "A company with this code already exists.",
          409,
          "COMPANY_CODE_EXISTS",
        );
      }
    }

    const company = await prisma.company.create({
      data: {
        name: data.name.trim(),
        code: data.code ? data.code.trim() : null,
        description: data.description ? data.description.trim() : null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    await logAudit({
      actorId,
      action: "COMPANY_CREATED",
      entityType: "Company",
      entityId: company.id,
      metadata: { name: company.name, code: company.code },
    });

    return company;
  }

  static async updateCompany(
    actorId: string,
    id: string,
    data: { name?: string; code?: string; description?: string | null; isActive?: boolean },
  ) {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new AppError("Company not found.", 404, "COMPANY_NOT_FOUND");
    }

    if (data.name && data.name.trim() !== company.name) {
      const existing = await prisma.company.findUnique({
        where: { name: data.name.trim() },
      });
      if (existing) {
        throw new AppError(
          "A company with this name already exists.",
          409,
          "COMPANY_EXISTS",
        );
      }
    }

    if (data.code && data.code.trim() !== company.code) {
      const existingCode = await prisma.company.findUnique({
        where: { code: data.code.trim() },
      });
      if (existingCode) {
        throw new AppError(
          "A company with this code already exists.",
          409,
          "COMPANY_CODE_EXISTS",
        );
      }
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.code !== undefined && { code: data.code ? data.code.trim() : null }),
        ...(data.description !== undefined && {
          description: data.description ? data.description.trim() : null,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await logAudit({
      actorId,
      action: "COMPANY_UPDATED",
      entityType: "Company",
      entityId: updated.id,
      metadata: { previous: company, updated },
    });

    return updated;
  }

  static async deleteCompany(actorId: string, id: string) {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!company) {
      throw new AppError("Company not found.", 404, "COMPANY_NOT_FOUND");
    }

    if (company._count.products > 0) {
      throw new AppError(
        "Cannot delete company with associated products. Deactivate it instead.",
        400,
        "COMPANY_HAS_PRODUCTS",
      );
    }

    await prisma.company.delete({ where: { id } });

    await logAudit({
      actorId,
      action: "COMPANY_DELETED",
      entityType: "Company",
      entityId: id,
      metadata: { name: company.name },
    });

    return { message: "Company deleted successfully." };
  }
}
