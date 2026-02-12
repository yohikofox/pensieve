import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserSubscription } from '../entities/user-subscription.entity';
import { Permission } from '../entities/permission.entity';

/**
 * Repository for UserSubscription entity
 */
@Injectable()
export class SubscriptionRepository extends Repository<UserSubscription> {
  constructor(private dataSource: DataSource) {
    super(UserSubscription, dataSource.createEntityManager());
  }

  /**
   * Find active subscription for a user
   * @param userId - User ID
   * @returns Active subscription or null
   */
  async findActiveByUserId(userId: string): Promise<UserSubscription | null> {
    return this.createQueryBuilder('subscription')
      .where('subscription.userId = :userId', { userId })
      .andWhere('subscription.status = :status', { status: 'active' })
      .andWhere(
        '(subscription.expiresAt IS NULL OR subscription.expiresAt > NOW())',
      )
      .leftJoinAndSelect('subscription.tier', 'tier')
      .orderBy('subscription.createdAt', 'DESC')
      .getOne();
  }

  /**
   * Find all permissions included in a user's subscription
   * @param userId - User ID
   * @returns List of permissions
   */
  async findPermissionsByUserId(userId: string): Promise<Permission[]> {
    const subscription = await this.createQueryBuilder('subscription')
      .where('subscription.userId = :userId', { userId })
      .andWhere('subscription.status = :status', { status: 'active' })
      .andWhere(
        '(subscription.expiresAt IS NULL OR subscription.expiresAt > NOW())',
      )
      .leftJoinAndSelect('subscription.tier', 'tier')
      .leftJoinAndSelect('tier.tierPermissions', 'tierPermission')
      .leftJoinAndSelect('tierPermission.permission', 'permission')
      .getOne();

    if (!subscription || !subscription.tier) {
      return [];
    }

    return (
      subscription.tier.tierPermissions?.map((tp) => tp.permission) || []
    );
  }

  /**
   * Check if user's subscription includes a permission
   * @param userId - User ID
   * @param permissionId - Permission ID
   * @returns true if subscription includes the permission
   */
  async hasPermission(
    userId: string,
    permissionId: string,
  ): Promise<boolean> {
    const count = await this.createQueryBuilder('subscription')
      .innerJoin('subscription.tier', 'tier')
      .innerJoin('tier.tierPermissions', 'tierPermission')
      .where('subscription.userId = :userId', { userId })
      .andWhere('subscription.status = :status', { status: 'active' })
      .andWhere(
        '(subscription.expiresAt IS NULL OR subscription.expiresAt > NOW())',
      )
      .andWhere('tierPermission.permissionId = :permissionId', { permissionId })
      .getCount();

    return count > 0;
  }
}
