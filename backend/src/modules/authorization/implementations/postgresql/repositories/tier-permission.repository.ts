import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TierPermission } from '../entities/tier-permission.entity';

@Injectable()
export class TierPermissionRepository extends Repository<TierPermission> {
  constructor(private dataSource: DataSource) {
    super(TierPermission, dataSource.createEntityManager());
  }

  async findByTierId(tierId: string): Promise<TierPermission[]> {
    return this.find({ where: { tierId } });
  }
}
