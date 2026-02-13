import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SubscriptionTier } from '../entities/subscription-tier.entity';

@Injectable()
export class SubscriptionTierRepository extends Repository<SubscriptionTier> {
  constructor(private dataSource: DataSource) {
    super(SubscriptionTier, dataSource.createEntityManager());
  }

  async findAll(): Promise<SubscriptionTier[]> {
    return this.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<SubscriptionTier | null> {
    return this.findOne({ where: { id } });
  }
}
