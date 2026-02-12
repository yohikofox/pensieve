import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { UserRole } from './user-role.entity';

/**
 * Role Entity
 * Represents system and custom roles
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 200 })
  displayName!: string;

  @Column({ type: 'boolean', default: false })
  isSystem!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions!: RolePermission[];

  @OneToMany(() => UserRole, (ur) => ur.role)
  userRoles!: UserRole[];
}
