import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';

/**
 * Repository for Permission entity
 */
@Injectable()
export class PermissionRepository extends Repository<Permission> {
  constructor(private dataSource: DataSource) {
    super(Permission, dataSource.createEntityManager());
  }

  /**
   * Find permission by name
   * @param name - Permission name (e.g., "thought.read")
   * @returns Permission or null
   */
  async findByName(name: string): Promise<Permission | null> {
    return this.findOne({ where: { name } });
  }

  /**
   * Find all permissions for a resource type
   * @param resourceType - Resource type
   * @returns List of permissions
   */
  async findByResourceType(resourceType: string): Promise<Permission[]> {
    return this.find({ where: { resourceType } });
  }

  /**
   * Find all paid features
   * @returns List of paid permissions
   */
  async findPaidFeatures(): Promise<Permission[]> {
    return this.find({ where: { isPaidFeature: true } });
  }
}
