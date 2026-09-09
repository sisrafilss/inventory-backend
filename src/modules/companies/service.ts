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

  static async getNextCompanyCode(): Promise<string> {
    const companies = await prisma.company.findMany({
      select: { code: true },
      where: { code: { not: null } },
    });

    const usedCodes = new Set(
      companies
        .map((c) => c.code)
        .filter((c): c is string => !!c && /^[1-9][0-9]{2}$/.test(c))
        .map((c) => parseInt(c, 10)),
    );

    for (let num = 101; num <= 999; num++) {
      if (!usedCodes.has(num)) {
        return String(num);
      }
    }

    if (!usedCodes.has(100)) return "100";

    throw new AppError(
      "All 3-digit company codes (100-999) are already in use.",
      400,
      "COMPANY_CODES_EXHAUSTED",
    );
  }

  static async checkCompanyCode(code: string, excludeId?: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      return { exists: false };
    }

    const company = await prisma.company.findFirst({
      where: {
        code: trimmed,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true, code: true },
    });

    return {
      exists: Boolean(company),
      company: company || null,
    };
  }

  static async createCompany(
    actorId: string,
    data: {
      name: string;
      code?: string | null;
      description?: string | null;
      isActive?: boolean;
    },
  ) {
    const trimmedName = data.name.trim();
    const existing = await prisma.company.findUnique({
      where: { name: trimmedName },
    });

    if (existing) {
      throw new AppError(
        "A company with this name already exists.",
        409,
        "COMPANY_EXISTS",
      );
    }

    let finalCode: string;
    if (data.code && data.code.trim()) {
      finalCode = data.code.trim();
      if (!/^[1-9][0-9]{2}$/.test(finalCode)) {
        throw new AppError(
          "Company code must be a 3-digit number (100-999) without leading zero.",
          400,
          "INVALID_COMPANY_CODE",
        );
      }
      const existingCode = await prisma.company.findUnique({
        where: { code: finalCode },
      });
      if (existingCode) {
        throw new AppError(
          `A company with code "${finalCode}" already exists (${existingCode.name}).`,
          409,
          "COMPANY_CODE_EXISTS",
        );
      }
    } else {
      // Auto-generate next 3-digit code
      finalCode = await this.getNextCompanyCode();
    }

    const company = await prisma.company.create({
      data: {
        name: trimmedName,
        code: finalCode,
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
    data: {
      name?: string;
      code?: string;
      description?: string | null;
      isActive?: boolean;
    },
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

    if (
      data.code !== undefined &&
      data.code !== null &&
      data.code.trim() !== ""
    ) {
      const trimmedCode = data.code.trim();
      if (!/^[1-9][0-9]{2}$/.test(trimmedCode)) {
        throw new AppError(
          "Company code must be a 3-digit number (100-999) without leading zero.",
          400,
          "INVALID_COMPANY_CODE",
        );
      }
      if (trimmedCode !== company.code) {
        const existingCode = await prisma.company.findUnique({
          where: { code: trimmedCode },
        });
        if (existingCode && existingCode.id !== id) {
          throw new AppError(
            `A company with code "${trimmedCode}" already exists (${existingCode.name}).`,
            409,
            "COMPANY_CODE_EXISTS",
          );
        }
      }
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.code !== undefined && {
          code: data.code ? data.code.trim() : null,
        }),
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
