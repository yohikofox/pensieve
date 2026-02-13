import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../entities/user-role.entity';

/**
 * Repository for UserRole entity
 */
@Injectable()
export class UserRoleRepository extends Repository<UserRole> {
  constructor(private dataSource: DataSource) {
    super(UserRole, dataSource.createEntityManager());
  }

  /**
   * Find all roles for a user (including expired)
   * @param userId - User ID
   * @returns List of all user roles
   */
  async findByUserId(userId: string): Promise<UserRole[]> {
    return this.createQueryBuilder('userRole')
      .where('userRole.userId = :userId', { userId })
      .leftJoinAndSelect('userRole.role', 'role')
      .getMany();
  }

  /**
   * Find active roles for a user
   * @param userId - User ID
   * @returns List of active user roles
   */
  async findActiveByUserId(userId: string): Promise<UserRole[]> {
    return this.createQueryBuilder('userRole')
      .where('userRole.userId = :userId', { userId })
      .andWhere('(userRole.expiresAt IS NULL OR userRole.expiresAt > NOW())')
      .leftJoinAndSelect('userRole.role', 'role')
      .getMany();
  }

  /**
   * Find a specific user-role assignment
   * @param userId - User ID
   * @param roleId - Role ID
   * @returns UserRole or null
   */
  async findByUserAndRole(
    userId: string,
    roleId: string,
  ): Promise<UserRole | null> {
    return this.findOneBy({ userId, roleId });
  }

  /**
   * Check if user has a specific role
   * @param userId - User ID
   * @param roleId - Role ID
   * @returns true if user has the role
   */
  async hasRole(userId: string, roleId: string): Promise<boolean> {
    const count = await this.count({
      where: {
        userId,
        roleId,
      },
    });

    return count > 0;
  }
}
