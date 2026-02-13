import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

/**
 * Repository for Role entity
 */
@Injectable()
export class RoleRepository extends Repository<Role> {
  constructor(private dataSource: DataSource) {
    super(Role, dataSource.createEntityManager());
  }

  /**
   * Find all roles
   * @returns List of all roles
   */
  async findAll(): Promise<Role[]> {
    return this.find();
  }

  /**
   * Find role by ID
   * @param id - Role ID
   * @returns Role or null
   */
  async findById(id: string): Promise<Role | null> {
    return this.findOneBy({ id });
  }

  /**
   * Find role by name
   * @param name - Role name (e.g., "admin", "user")
   * @returns Role or null
   */
  async findByName(name: string): Promise<Role | null> {
    return this.findOne({ where: { name } });
  }

  /**
   * Find all roles for a user
   * @param userId - User ID
   * @returns List of roles
   */
  async findByUserId(userId: string): Promise<Role[]> {
    return this.createQueryBuilder('role')
      .innerJoin('role.userRoles', 'userRole')
      .where('userRole.userId = :userId', { userId })
      .andWhere('(userRole.expiresAt IS NULL OR userRole.expiresAt > NOW())')
      .getMany();
  }

  /**
   * Find all permissions for a role
   * @param roleId - Role ID
   * @returns List of permissions
   */
  async findPermissionsByRoleId(roleId: string): Promise<Permission[]> {
    const role = await this.findOne({
      where: { id: roleId },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });

    return role?.rolePermissions.map((rp) => rp.permission) || [];
  }
}
