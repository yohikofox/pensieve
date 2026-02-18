/**
 * CaptureStateRepository — Repository cacheable pour les états de capture
 *
 * ADR-027: Namespace 'capture-state', cache via ICacheClient.
 * Permet de résoudre un CaptureState par ID ou par nom sans lookup DB répété.
 */

import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CacheableRepository } from '../../../../common/repositories/cacheable.repository';
import type { ICacheClient } from '../../../../common/cache/i-cache-client.interface';
import { CaptureState } from '../../domain/entities/capture-state.entity';

@Injectable()
export class CaptureStateRepository extends CacheableRepository<CaptureState> {
  constructor(
    @Inject('ICacheClient') cacheClient: ICacheClient,
    @InjectRepository(CaptureState)
    private readonly orm: Repository<CaptureState>,
  ) {
    super(cacheClient, 'capture-state');
  }

  protected async queryByIds(ids: string[]): Promise<CaptureState[]> {
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
