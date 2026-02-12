import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserPermission } from '../entities/user-permission.entity';

/**
 * Repository for UserPermission entity
 */
@Injectable()
export class UserPermissionRepository extends Repository<UserPermission> {
  constructor(private dataSource: DataSource) {
    super(UserPermission, dataSource.createEntityManager());
  }

  /**
   * Find user override for a permission
   * @param userId - User ID
   * @param permissionId - Permission ID
   * @returns UserPermission or null
   */
  async findOverride(
    userId: string,
    permissionId: string,
  ): Promise<UserPermission | null> {
    return this.createQueryBuilder('userPermission')
      .where('userPermission.userId = :userId', { userId })
      .andWhere('userPermission.permissionId = :permissionId', { permissionId })
      .andWhere(
        '(userPermission.expiresAt IS NULL OR userPermission.expiresAt > NOW())',
      )
      .getOne();
  }

  /**
   * Find all active overrides for a user
   * @param userId - User ID
   * @returns List of user permissions
   */
  async findActiveByUserId(userId: string): Promise<UserPermission[]> {
    return this.createQueryBuilder('userPermission')
      .where('userPermission.userId = :userId', { userId })
      .andWhere(
        '(userPermission.expiresAt IS NULL OR userPermission.expiresAt > NOW())',
      )
      .leftJoinAndSelect('userPermission.permission', 'permission')
      .getMany();
  }
}
