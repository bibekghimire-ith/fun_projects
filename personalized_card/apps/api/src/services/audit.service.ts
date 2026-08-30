import { prisma } from '../config/prisma';
import { AuditAction } from '@prisma/client';

export class AuditService {
  async log(
    userId: string | null,
    experienceId: string | null,
    action: AuditAction,
    metadata?: Record<string, unknown>,
  ) {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        experienceId: experienceId ?? undefined,
        action,
        metadata: metadata ?? undefined,
      },
    });
  }
}

export const auditService = new AuditService();
