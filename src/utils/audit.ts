import { prisma } from "../config/db.js";
import { Prisma } from "@prisma/client";

export interface AuditEventParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export const logAudit = async (
  params: AuditEventParams,
  tx?: Prisma.TransactionClient,
) => {
  try {
    const client = tx || prisma;
    await client.auditLog.create({
      data: {
        actorId: params.actorId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        metadata: params.metadata || Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
};
