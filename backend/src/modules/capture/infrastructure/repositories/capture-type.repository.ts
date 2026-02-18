/**
 * CaptureTypeRepository — Repository cacheable pour les types de capture
 *
 * ADR-027: Namespace 'capture-type', cache via ICacheClient.
 * Permet de résoudre un CaptureType par ID ou par nom sans lookup DB répété.
 */

import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CacheableRepository } from '../../../../common/repositories/cacheable.repository';
import type { ICacheClient } from '../../../../common/cache/i-cache-client.interface';
import { CaptureType } from '../../domain/entities/capture-type.entity';

@Injectable()
export class CaptureTypeRepository extends CacheableRepository<CaptureType> {
  constructor(
    @Inject('ICacheClient') cacheClient: ICacheClient,
    @InjectRepository(CaptureType)
    private readonly orm: Repository<CaptureType>,
  ) {
    super(cacheClient, 'capture-type');
  }

  protected async queryByIds(ids: string[]): Promise<CaptureType[]> {
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
