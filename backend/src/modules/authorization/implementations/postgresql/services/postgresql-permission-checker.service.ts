import { Injectable } from '@nestjs/common';
import { IPermissionChecker } from '../../../core/interfaces/permission-checker.interface';
import { RoleRepository } from '../repositories/role.repository';
import { UserPermissionRepository } from '../repositories/user-permission.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { DataSource } from 'typeorm';

/**
 * PostgreSQL implementation of permission checker
 *
 * Provides low-level permission checks for different sources
 */
@Injectable()
export class PostgreSQLPermissionChecker implements IPermissionChecker {
  constructor(
    private readonly roleRepo: RoleRepository,
    private readonly userPermissionRepo: UserPermissionRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Check if user has permission via roles
   */
  async checkRolePermission(
    userId: string,
    permissionId: string,
  ): Promise<boolean> {
    const result = await this.dataSource.query(
      `
      SELECT 1
      FROM role_permissions rp
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
      AND rp.permission_id = $2
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      LIMIT 1
    `,
      [userId, permissionId],
    );

    return result.length > 0;
  }

  /**
   * Check if user has permission via subscription
   */
  async checkSubscriptionPermission(
    userId: string,
    permissionId: string,
  ): Promise<boolean> {
    return this.subscriptionRepo.hasPermission(userId, permissionId);
  }

  /**
   * Check if user has an override for a permission
   * Returns true if granted, false if denied, null if no override
   */
  async checkUserOverride(
    userId: string,
    permissionId: string,
  ): Promise<boolean | null> {
    const override = await this.userPermissionRepo.findOverride(
      userId,
      permissionId,
    );

    if (!override) {
      return null; // No override
    }

    return override.granted;
  }
}
