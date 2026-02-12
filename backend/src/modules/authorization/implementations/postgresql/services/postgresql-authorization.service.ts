import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import {
  PermissionCheckParams,
  ShareResourceParams,
  ResourceType,
} from '../../../core';
import type { IAuthorizationService } from '../../../core';
import type * as PermissionCheckerNS from '../../../core/interfaces/permission-checker.interface';
import type * as ResourceAccessControlNS from '../../../core/interfaces/resource-access-control.interface';
import { PermissionRepository } from '../repositories/permission.repository';
import { ResourceShareRepository } from '../repositories/resource-share.repository';
import { ResourceShare } from '../entities/resource-share.entity';
import { DataSource } from 'typeorm';

type IPermissionChecker = PermissionCheckerNS.IPermissionChecker;
type IResourceAccessControl = ResourceAccessControlNS.IResourceAccessControl;

/**
 * PostgreSQL implementation of the authorization service
 *
 * Implements multi-level permission resolution:
 * 1. User override (highest priority)
 * 2. Resource share (if resourceId provided)
 * 3. Subscription tier (if paid feature)
 * 4. Role-based (default)
 */
@Injectable()
export class PostgreSQLAuthorizationService implements IAuthorizationService {
  constructor(
    private readonly permissionRepo: PermissionRepository,
    private readonly resourceShareRepo: ResourceShareRepository,
    @Inject('IPermissionChecker')
    private readonly permissionChecker: IPermissionChecker,
    @Inject('IResourceAccessControl')
    private readonly resourceAccessControl: IResourceAccessControl,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Check if user has a permission
   * Implements multi-level resolution strategy
   */
  async hasPermission(params: PermissionCheckParams): Promise<boolean> {
    // Get permission entity
    const permission = await this.permissionRepo.findByName(params.permission);
    if (!permission) {
      throw new NotFoundException(
        `Permission "${params.permission}" not found`,
      );
    }

    // 1. Check user override (highest priority)
    const userOverride = await this.permissionChecker.checkUserOverride(
      params.userId,
      permission.id,
    );

    if (userOverride !== null) {
      return userOverride; // true if granted, false if denied
    }

    // 2. Check resource share (if resourceId provided)
    if (params.resourceId && params.resourceType) {
      const hasShareAccess = await this.resourceAccessControl.hasShareAccess(
        params.userId,
        params.resourceType,
        params.resourceId,
        params.permission,
      );

      if (hasShareAccess) {
        return true;
      }
    }

    // 3. Check subscription tier (if paid feature)
    if (permission.isPaidFeature) {
      const hasSubscription =
        await this.permissionChecker.checkSubscriptionPermission(
          params.userId,
          permission.id,
        );

      if (!hasSubscription) {
        return false; // Paid feature without subscription
      }
    }

    // 4. Check role-based permissions (default)
    return this.permissionChecker.checkRolePermission(
      params.userId,
      permission.id,
    );
  }

  /**
   * Get all permissions for a user
   * Includes: role permissions + subscription permissions + overrides
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const permissionNames = new Set<string>();

    // Get all permissions from roles
    const rolePermissions = await this.dataSource.query(
      `
      SELECT DISTINCT p.name
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `,
      [userId],
    );

    rolePermissions.forEach((row: { name: string }) =>
      permissionNames.add(row.name),
    );

    // Get all permissions from subscription
    const subscriptionPermissions = await this.dataSource.query(
      `
      SELECT DISTINCT p.name
      FROM permissions p
      INNER JOIN tier_permissions tp ON p.id = tp.permission_id
      INNER JOIN user_subscriptions us ON tp.tier_id = us.tier_id
      WHERE us.user_id = $1
      AND us.status = 'active'
      AND (us.expires_at IS NULL OR us.expires_at > NOW())
    `,
      [userId],
    );

    subscriptionPermissions.forEach((row: { name: string }) =>
      permissionNames.add(row.name),
    );

    // Apply user overrides
    const userOverrides = await this.dataSource.query(
      `
      SELECT p.name, up.granted
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = $1
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
    `,
      [userId],
    );

    userOverrides.forEach((row: { name: string; granted: boolean }) => {
      if (row.granted) {
        permissionNames.add(row.name);
      } else {
        permissionNames.delete(row.name); // Override denial
      }
    });

    return Array.from(permissionNames);
  }

  /**
   * Check if user is the owner of a resource
   */
  async isResourceOwner(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<boolean> {
    // Map resource type to table name
    const tableMap: Record<ResourceType, string> = {
      [ResourceType.THOUGHT]: 'thoughts',
      [ResourceType.IDEA]: 'ideas',
      [ResourceType.TODO]: 'todos',
    };

    const tableName = tableMap[resourceType];
    if (!tableName) {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }

    // Query to check ownership
    const result = await this.dataSource.query(
      `SELECT 1 FROM ${tableName} WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [resourceId, userId],
    );

    return result.length > 0;
  }

  /**
   * Share a resource with another user
   */
  async shareResource(params: ShareResourceParams): Promise<void> {
    // Verify ownership
    const isOwner = await this.isResourceOwner(
      params.ownerId,
      params.resourceType,
      params.resourceId,
    );

    if (!isOwner) {
      throw new ForbiddenException('Only the owner can share this resource');
    }

    // Verify resource exists
    const tableMap: Record<ResourceType, string> = {
      [ResourceType.THOUGHT]: 'thoughts',
      [ResourceType.IDEA]: 'ideas',
      [ResourceType.TODO]: 'todos',
    };

    const tableName = tableMap[params.resourceType];
    const resourceExists = await this.dataSource.query(
      `SELECT 1 FROM ${tableName} WHERE id = $1 LIMIT 1`,
      [params.resourceId],
    );

    if (resourceExists.length === 0) {
      throw new NotFoundException(`${params.resourceType} not found`);
    }

    // Get share role ID
    const shareRoleResult = await this.dataSource.query(
      `SELECT id FROM share_roles WHERE name = $1 AND resource_type = $2 LIMIT 1`,
      [params.shareRole, params.resourceType],
    );

    if (shareRoleResult.length === 0) {
      throw new NotFoundException(
        `Share role "${params.shareRole}" not found for ${params.resourceType}`,
      );
    }

    const shareRoleId = shareRoleResult[0].id;

    // Check if share already exists
    const existingShare = await this.resourceShareRepo.findOne({
      where: {
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        sharedWithId: params.sharedWithId,
      },
    });

    if (existingShare) {
      // Update existing share
      existingShare.shareRoleId = shareRoleId;
      existingShare.expiresAt = params.expiresAt || null;
      await this.resourceShareRepo.save(existingShare);
    } else {
      // Create new share
      const share = new ResourceShare();
      share.resourceType = params.resourceType;
      share.resourceId = params.resourceId;
      share.ownerId = params.ownerId;
      share.sharedWithId = params.sharedWithId;
      share.shareRoleId = shareRoleId;
      share.expiresAt = params.expiresAt || null;

      await this.resourceShareRepo.save(share);
    }
  }

  /**
   * Revoke a resource share
   */
  async revokeShare(shareId: string): Promise<void> {
    const share = await this.resourceShareRepo.findOne({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    await this.resourceShareRepo.remove(share);
  }
}
