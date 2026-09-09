import { prisma } from "../../config/db.js";
import { AppError } from "../../errors/AppError.js";
import { logAudit } from "../../utils/audit.js";
import { Prisma } from "@prisma/client";

export class PartiesService {
  // ================= SUPPLIERS =================
  static async listSuppliers(query: {
    search?: string;
    isActive?: boolean;
    hasDue?: boolean;
  }) {
    const where: Prisma.SupplierWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.hasDue) {
      where.currentDue = { gt: 0 };
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }

    return prisma.supplier.findMany({
      where,
      orderBy: [{ currentDue: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { purchases: true, payments: true },
        },
      },
    });
  }

  static async getSupplierById(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            dueAmount: true,
            createdAt: true,
          },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!supplier) {
      throw new AppError("Supplier not found.", 404, "SUPPLIER_NOT_FOUND");
    }

    return supplier;
  }

  static async createSupplier(
    actorId: string,
    data: {
      name: string;
      companyName?: string;
      phone: string;
      email?: string;
      address?: string;
      openingDue?: number;
      isActive?: boolean;
    },
  ) {
    const openingDue = data.openingDue || 0;

    const supplier = await prisma.supplier.create({
      data: {
        name: data.name.trim(),
        companyName: data.companyName ? data.companyName.trim() : null,
        phone: data.phone.trim(),
        email: data.email && data.email.trim() ? data.email.trim() : null,
        address: data.address ? data.address.trim() : null,
        openingDue,
        currentDue: openingDue,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    await logAudit({
      actorId,
      action: "SUPPLIER_CREATED",
      entityType: "Supplier",
      entityId: supplier.id,
      metadata: {
        name: supplier.name,
        phone: supplier.phone,
        currentDue: supplier.currentDue,
      },
    });

    return supplier;
  }

  static async updateSupplier(
    actorId: string,
    id: string,
    data: {
      name?: string;
      companyName?: string | null;
      phone?: string;
      email?: string | null;
      address?: string | null;
      isActive?: boolean;
    },
  ) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new AppError("Supplier not found.", 404, "SUPPLIER_NOT_FOUND");
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.companyName !== undefined && {
          companyName: data.companyName ? data.companyName.trim() : null,
        }),
        ...(data.phone && { phone: data.phone.trim() }),
        ...(data.email !== undefined && {
          email: data.email && data.email.trim() ? data.email.trim() : null,
        }),
        ...(data.address !== undefined && {
          address: data.address ? data.address.trim() : null,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await logAudit({
      actorId,
      action: "SUPPLIER_UPDATED",
      entityType: "Supplier",
      entityId: updated.id,
      metadata: { previous: supplier, updated },
    });

    return updated;
  }

  static async deleteSupplier(actorId: string, id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { purchases: true, payments: true } },
      },
    });

    if (!supplier) {
      throw new AppError("Supplier not found.", 404, "SUPPLIER_NOT_FOUND");
    }

    if (supplier._count.purchases > 0 || supplier._count.payments > 0) {
      throw new AppError(
        "Cannot delete supplier with transaction history. Deactivate instead.",
        400,
        "SUPPLIER_HAS_TRANSACTIONS",
      );
    }

    await prisma.supplier.delete({ where: { id } });

    await logAudit({
      actorId,
      action: "SUPPLIER_DELETED",
      entityType: "Supplier",
      entityId: id,
      metadata: { name: supplier.name },
    });

    return { message: "Supplier deleted successfully." };
  }

  // ================= CUSTOMERS =================
  static async listCustomers(query: {
    search?: string;
    isActive?: boolean;
    hasDue?: boolean;
  }) {
    const where: Prisma.CustomerWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.hasDue) {
      where.currentDue = { gt: 0 };
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }

    return prisma.customer.findMany({
      where,
      orderBy: [{ currentDue: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { sales: true, payments: true },
        },
      },
    });
  }

  static async getCustomerByCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new AppError("Customer ID is required.", 400, "INVALID_CODE");
    }

    const cleanDigits = trimmed.replace(/[^0-9]/g, "");

    // 1. Try finding by UUID, UUID prefix, exact phone, clean phone, or name
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: { equals: trimmed, mode: "insensitive" } },
          { id: { startsWith: trimmed, mode: "insensitive" } },
          { phone: { equals: trimmed, mode: "insensitive" } },
          ...(cleanDigits.length >= 4
            ? [
                {
                  phone: {
                    contains: cleanDigits,
                    mode: "insensitive" as const,
                  },
                },
              ]
            : []),
          { name: { equals: trimmed, mode: "insensitive" } },
          { name: { startsWith: trimmed, mode: "insensitive" } },
          { name: { contains: trimmed, mode: "insensitive" } },
        ],
      },
    });

    // 2. If not found and input is an integer (e.g. 1, 2, 3...), lookup by sequential order
    if (!customer) {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num > 0 && String(num) === trimmed) {
        const sequential = await prisma.customer.findMany({
          orderBy: { createdAt: "asc" },
          skip: num - 1,
          take: 1,
        });
        if (sequential.length > 0) {
          customer = sequential[0];
        }
      }
    }

    if (!customer) {
      throw new AppError(
        `Customer "${trimmed}" not found in database.`,
        404,
        "CUSTOMER_NOT_FOUND",
      );
    }

    return {
      ...customer,
      openingDue: Number(customer.openingDue),
      currentDue: Number(customer.currentDue),
    };
  }

  static async getSupplierByCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new AppError("Supplier ID is required.", 400, "INVALID_CODE");
    }

    const cleanDigits = trimmed.replace(/[^0-9]/g, "");

    // 1. Try finding by UUID, UUID prefix, exact phone, clean phone, name, or companyName
    let supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { id: { equals: trimmed, mode: "insensitive" } },
          { id: { startsWith: trimmed, mode: "insensitive" } },
          { phone: { equals: trimmed, mode: "insensitive" } },
          ...(cleanDigits.length >= 4
            ? [
                {
                  phone: {
                    contains: cleanDigits,
                    mode: "insensitive" as const,
                  },
                },
              ]
            : []),
          { name: { equals: trimmed, mode: "insensitive" } },
          { name: { startsWith: trimmed, mode: "insensitive" } },
          { companyName: { equals: trimmed, mode: "insensitive" } },
          { companyName: { startsWith: trimmed, mode: "insensitive" } },
        ],
      },
    });

    // 2. If not found and input is an integer (e.g. 1, 2, 3...), lookup by sequential order
    if (!supplier) {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num > 0 && String(num) === trimmed) {
        const sequential = await prisma.supplier.findMany({
          orderBy: { createdAt: "asc" },
          skip: num - 1,
          take: 1,
        });
        if (sequential.length > 0) {
          supplier = sequential[0];
        }
      }
    }

    if (!supplier) {
      throw new AppError(
        `Supplier "${trimmed}" not found in database.`,
        404,
        "SUPPLIER_NOT_FOUND",
      );
    }

    return {
      ...supplier,
      openingDue: Number(supplier.openingDue),
      currentDue: Number(supplier.currentDue),
    };
  }

  static async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            referenceNumber: true,
            totalAmount: true,
            paidAmount: true,
            dueAmount: true,
            status: true,
            createdAt: true,
          },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer) {
      throw new AppError("Customer not found.", 404, "CUSTOMER_NOT_FOUND");
    }

    return customer;
  }

  static async createCustomer(
    actorId: string,
    data: {
      name: string;
      phone: string;
      email?: string;
      address?: string;
      openingDue?: number;
      isActive?: boolean;
    },
  ) {
    const openingDue = data.openingDue || 0;

    const customer = await prisma.customer.create({
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email && data.email.trim() ? data.email.trim() : null,
        address: data.address ? data.address.trim() : null,
        openingDue,
        currentDue: openingDue,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    await logAudit({
      actorId,
      action: "CUSTOMER_CREATED",
      entityType: "Customer",
      entityId: customer.id,
      metadata: {
        name: customer.name,
        phone: customer.phone,
        currentDue: customer.currentDue,
      },
    });

    return customer;
  }

  static async updateCustomer(
    actorId: string,
    id: string,
    data: {
      name?: string;
      phone?: string;
      email?: string | null;
      address?: string | null;
      isActive?: boolean;
    },
  ) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new AppError("Customer not found.", 404, "CUSTOMER_NOT_FOUND");
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.phone && { phone: data.phone.trim() }),
        ...(data.email !== undefined && {
          email: data.email && data.email.trim() ? data.email.trim() : null,
        }),
        ...(data.address !== undefined && {
          address: data.address ? data.address.trim() : null,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await logAudit({
      actorId,
      action: "CUSTOMER_UPDATED",
      entityType: "Customer",
      entityId: updated.id,
      metadata: { previous: customer, updated },
    });

    return updated;
  }

  static async deleteCustomer(actorId: string, id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { sales: true, payments: true } },
      },
    });

    if (!customer) {
      throw new AppError("Customer not found.", 404, "CUSTOMER_NOT_FOUND");
    }

    if (customer._count.sales > 0 || customer._count.payments > 0) {
      throw new AppError(
        "Cannot delete customer with transaction history. Deactivate instead.",
        400,
        "CUSTOMER_HAS_TRANSACTIONS",
      );
    }

    await prisma.customer.delete({ where: { id } });

    await logAudit({
      actorId,
      action: "CUSTOMER_DELETED",
      entityType: "Customer",
      entityId: id,
      metadata: { name: customer.name },
    });

    return { message: "Customer deleted successfully." };
  }

  // ================= SUMMARY =================
  static async getDuesSummary() {
    const [customerDues, supplierDues] = await Promise.all([
      prisma.customer.aggregate({
        _sum: { currentDue: true },
        where: { currentDue: { gt: 0 } },
      }),
      prisma.supplier.aggregate({
        _sum: { currentDue: true },
        where: { currentDue: { gt: 0 } },
      }),
    ]);

    return {
      totalCustomerReceivables: Number(customerDues._sum.currentDue || 0),
      totalSupplierPayables: Number(supplierDues._sum.currentDue || 0),
    };
  }
}
