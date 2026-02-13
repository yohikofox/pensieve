import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserSubscription } from '../entities/user-subscription.entity';

@Injectable()
export class UserSubscriptionRepository extends Repository<UserSubscription> {
  constructor(private dataSource: DataSource) {
    super(UserSubscription, dataSource.createEntityManager());
  }

  async findActiveByUserId(userId: string): Promise<UserSubscription | null> {
    return this.createQueryBuilder('subscription')
      .where('subscription.userId = :userId', { userId })
      .andWhere('subscription.status = :status', { status: 'active' })
      .andWhere(
        '(subscription.expiresAt IS NULL OR subscription.expiresAt > NOW())',
      )
      .orderBy('subscription.createdAt', 'DESC')
      .getOne();
  }

  async findByTierId(tierId: string): Promise<UserSubscription[]> {
    return this.find({ where: { tierId } });
  }
}
