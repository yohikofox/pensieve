/**
 * CaptureSyncStatusRepository — Repository cacheable pour les statuts de sync
 *
 * ADR-027: Namespace 'capture-sync-status', cache via ICacheClient.
 * Permet de résoudre un CaptureSyncStatus par ID ou par nom sans lookup DB répété.
 */

import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CacheableRepository } from '../../../../common/repositories/cacheable.repository';
import type { ICacheClient } from '../../../../common/cache/i-cache-client.interface';
import { CaptureSyncStatus } from '../../domain/entities/capture-sync-status.entity';

@Injectable()
export class CaptureSyncStatusRepository extends CacheableRepository<CaptureSyncStatus> {
  constructor(
    @Inject('ICacheClient') cacheClient: ICacheClient,
    @InjectRepository(CaptureSyncStatus)
    private readonly orm: Repository<CaptureSyncStatus>,
  ) {
    super(cacheClient, 'capture-sync-status');
  }

  protected async queryByIds(ids: string[]): Promise<CaptureSyncStatus[]> {
    return this.orm.findBy({ id: In(ids) });
  }

  protected async resolveIdByNaturalKey(name: string): Promise<string | null> {
    const entity = await this.orm.findOne({
      select: ['id'],
      where: { name },
    });
    return entity?.id ?? null;
  }
}
