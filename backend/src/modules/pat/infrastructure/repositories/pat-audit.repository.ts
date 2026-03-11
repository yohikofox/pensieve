import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PATAuditLog } from '../../domain/entities/pat-audit-log.entity';

@Injectable()
export class PATAuditRepository {
  constructor(
    @InjectRepository(PATAuditLog)
    private readonly repo: Repository<PATAuditLog>,
  ) {}

  async save(log: PATAuditLog): Promise<PATAuditLog> {
    await this.repo.insert(log);
    return log;
  }

  async findByUserId(userId: string, limit = 100): Promise<PATAuditLog[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
