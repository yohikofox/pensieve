import { Injectable } from '@nestjs/common';
import { IResourceAccessControl } from '../../../core/interfaces/resource-access-control.interface';
import { ResourceType } from '../../../core/enums/resource-type.enum';
import { ResourceShareRepository } from '../repositories/resource-share.repository';

/**
 * PostgreSQL implementation of resource access control
 *
 * Handles shared resource access checks (ACL)
 */
@Injectable()
export class PostgreSQLResourceAccessControl implements IResourceAccessControl {
  constructor(private readonly resourceShareRepo: ResourceShareRepository) {}

  /**
   * Check if user has access to a resource via sharing
   */
  async hasShareAccess(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    requiredPermission: string,
  ): Promise<boolean> {
    return this.resourceShareRepo.hasAccessWithPermission(
      resourceType,
      resourceId,
      userId,
      requiredPermission,
    );
  }

  /**
   * Get all resources shared with a user
   */
  async getSharedResources(
    userId: string,
    resourceType: ResourceType,
  ): Promise<string[]> {
    return this.resourceShareRepo.findSharedResourceIds(userId, resourceType);
  }
}
