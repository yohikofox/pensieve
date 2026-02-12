import {
  Entity,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { ShareRole } from './share-role.entity';
import { Permission } from './permission.entity';

/**
 * ShareRolePermission Entity
 * Many-to-many relation between share roles and permissions
 */
@Entity('share_role_permissions')
export class ShareRolePermission {
  @PrimaryColumn('uuid')
  shareRoleId!: string;

  @PrimaryColumn('uuid')
  permissionId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => ShareRole, (shareRole) => shareRole.shareRolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shareRoleId' })
  shareRole!: ShareRole;

  @ManyToOne(() => Permission, (permission) => permission.shareRolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionId' })
  permission!: Permission;
}
