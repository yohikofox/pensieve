/**
 * ThoughtStatusRepository — Repository cacheable pour les statuts de thought
 *
 * ADR-027: Namespace 'thought-status', cache via ICacheClient.
 * Permet de résoudre un ThoughtStatus par ID ou par code sans lookup DB répété.
 */

import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CacheableRepository } from '../../../../common/repositories/cacheable.repository';
import type { ICacheClient } from '../../../../common/cache/i-cache-client.interface';
import { ThoughtStatus } from '../../domain/entities/thought-status.entity';

@Injectable()
export class ThoughtStatusRepository extends CacheableRepository<ThoughtStatus> {
  constructor(
    @Inject('ICacheClient') cacheClient: ICacheClient,
    @InjectRepository(ThoughtStatus)
    private readonly orm: Repository<ThoughtStatus>,
  ) {
    super(cacheClient, 'thought-status');
  }

  protected async queryByIds(ids: string[]): Promise<ThoughtStatus[]> {
    return this.orm.findBy({ id: In(ids) });
  }

  protected async resolveIdByNaturalKey(code: string): Promise<string | null> {
    const entity = await this.orm.findOne({
      select: ['id'],
      where: { code },
    });
    return entity?.id ?? null;
  }
}
