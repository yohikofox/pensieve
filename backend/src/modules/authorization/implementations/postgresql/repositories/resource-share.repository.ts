import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ResourceShare } from '../entities/resource-share.entity';
import { ResourceType } from '../../../core/enums/resource-type.enum';

/**
 * Repository for ResourceShare entity
 */
@Injectable()
export class ResourceShareRepository extends Repository<ResourceShare> {
  constructor(private dataSource: DataSource) {
    super(ResourceShare, dataSource.createEntityManager());
  }

  /**
   * Find share by resource and user
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @param userId - User ID
   * @returns ResourceShare or null
   */
  async findByResource(
    resourceType: ResourceType,
    resourceId: string,
    userId: string,
  ): Promise<ResourceShare | null> {
    return this.createQueryBuilder('share')
      .where('share.resourceType = :resourceType', { resourceType })
      .andWhere('share.resourceId = :resourceId', { resourceId })
      .andWhere('share.sharedWithId = :userId', { userId })
      .andWhere('(share.expiresAt IS NULL OR share.expiresAt > NOW())')
      .leftJoinAndSelect('share.shareRole', 'shareRole')
      .leftJoinAndSelect(
        'shareRole.shareRolePermissions',
        'shareRolePermission',
      )
      .leftJoinAndSelect('shareRolePermission.permission', 'permission')
      .getOne();
  }

  /**
   * Find all resources shared with a user
   * @param userId - User ID
   * @param resourceType - Resource type (optional)
   * @returns List of resource IDs
   */
  async findSharedResourceIds(
    userId: string,
    resourceType?: ResourceType,
  ): Promise<string[]> {
    const query = this.createQueryBuilder('share')
      .select('share.resourceId')
      .where('share.sharedWithId = :userId', { userId })
      .andWhere('(share.expiresAt IS NULL OR share.expiresAt > NOW())');

    if (resourceType) {
      query.andWhere('share.resourceType = :resourceType', { resourceType });
    }

    const shares = await query.getMany();
    return shares.map((share) => share.resourceId);
  }

  /**
   * Find all shares owned by a user
   * @param ownerId - Owner user ID
   * @param resourceType - Resource type (optional)
   * @returns List of resource shares
   */
  async findByOwnerId(
    ownerId: string,
    resourceType?: ResourceType,
  ): Promise<ResourceShare[]> {
    const query = this.createQueryBuilder('share')
      .where('share.ownerId = :ownerId', { ownerId })
      .andWhere('(share.expiresAt IS NULL OR share.expiresAt > NOW())')
      .leftJoinAndSelect('share.shareRole', 'shareRole');

    if (resourceType) {
      query.andWhere('share.resourceType = :resourceType', { resourceType });
    }

    return query.getMany();
  }

  /**
   * Check if user has share access with required permission
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @param userId - User ID
   * @param requiredPermission - Required permission name
   * @returns true if user has access
   */
  async hasAccessWithPermission(
    resourceType: ResourceType,
    resourceId: string,
    userId: string,
    requiredPermission: string,
  ): Promise<boolean> {
    const count = await this.createQueryBuilder('share')
      .innerJoin('share.shareRole', 'shareRole')
      .innerJoin('shareRole.shareRolePermissions', 'shareRolePermission')
      .innerJoin('shareRolePermission.permission', 'permission')
      .where('share.resourceType = :resourceType', { resourceType })
      .andWhere('share.resourceId = :resourceId', { resourceId })
      .andWhere('share.sharedWithId = :userId', { userId })
      .andWhere('(share.expiresAt IS NULL OR share.expiresAt > NOW())')
      .andWhere('permission.name = :permissionName', {
        permissionName: requiredPermission,
      })
      .getCount();

    return count > 0;
  }

  /**
   * Find shares for a specific resource
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @returns List of shares
   */
  async findByResourceId(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ResourceShare[]> {
    return this.createQueryBuilder('share')
      .where('share.resourceType = :resourceType', { resourceType })
      .andWhere('share.resourceId = :resourceId', { resourceId })
      .andWhere('(share.expiresAt IS NULL OR share.expiresAt > NOW())')
      .leftJoinAndSelect('share.shareRole', 'shareRole')
      .getMany();
  }
}
