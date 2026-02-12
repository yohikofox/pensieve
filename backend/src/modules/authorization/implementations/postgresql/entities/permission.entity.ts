import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { UserPermission } from './user-permission.entity';
import { TierPermission } from './tier-permission.entity';
import { ShareRolePermission } from './share-role-permission.entity';

/**
 * Permission Entity
 * Represents available permissions in the system
 */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index('IDX_PERMISSIONS_NAME')
  name!: string;

  @Column({ type: 'varchar', length: 200 })
  displayName!: string;

  @Column({ type: 'varchar', length: 50 })
  resourceType!: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({ type: 'boolean', default: false })
  isPaidFeature!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions!: RolePermission[];

  @OneToMany(() => UserPermission, (up) => up.permission)
  userPermissions!: UserPermission[];

  @OneToMany(() => TierPermission, (tp) => tp.permission)
  tierPermissions!: TierPermission[];

  @OneToMany(() => ShareRolePermission, (srp) => srp.permission)
  shareRolePermissions!: ShareRolePermission[];
}
