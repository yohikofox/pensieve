import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PATAuditLog } from '../../domain/entities/pat-audit-log.entity';
import { PATAuditRepository } from '../../infrastructure/repositories/pat-audit.repository';

export interface PATAuditLogView {
  id: string;
  adminId: string;
  userId: string;
  patId: string;
  action: string;
  createdAt: Date;
}

function toView(log: PATAuditLog): PATAuditLogView {
  return {
    id: log.id,
    adminId: log.adminId,
    userId: log.userId,
    patId: log.patId,
    action: log.action,
    createdAt: log.createdAt,
  };
}

@Injectable()
export class PATAuditService {
  constructor(private readonly patAuditRepository: PATAuditRepository) {}

  async log(
    adminId: string,
    userId: string,
    patId: string,
    action: 'create' | 'revoke' | 'renew',
  ): Promise<void> {
    const entry = new PATAuditLog();
    entry.id = uuidv7();
    entry.adminId = adminId;
    entry.userId = userId;
    entry.patId = patId;
    entry.action = action;

    await this.patAuditRepository.save(entry);
  }

  async findByUserId(userId: string, limit = 100): Promise<PATAuditLogView[]> {
    const logs = await this.patAuditRepository.findByUserId(userId, limit);
    return logs.map(toView);
  }
}
