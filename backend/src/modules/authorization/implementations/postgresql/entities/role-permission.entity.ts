import {
  Entity,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

/**
 * RolePermission Entity
 * Many-to-many relation between roles and permissions
 */
@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn('uuid')
  roleId!: string;

  @PrimaryColumn('uuid')
  permissionId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionId' })
  permission!: Permission;
}
