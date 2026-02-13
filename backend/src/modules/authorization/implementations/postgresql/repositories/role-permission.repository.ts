import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RolePermission } from '../entities/role-permission.entity';

@Injectable()
export class RolePermissionRepository extends Repository<RolePermission> {
  constructor(private dataSource: DataSource) {
    super(RolePermission, dataSource.createEntityManager());
  }

  async findByRoleId(roleId: string): Promise<RolePermission[]> {
    return this.find({ where: { roleId } });
  }
}
