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
  @PrimaryColumn({ name: 'share_role_id', type: 'uuid' })
  shareRoleId!: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => ShareRole, (shareRole) => shareRole.shareRolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'share_role_id' })
  shareRole!: ShareRole;

  @ManyToOne(
    () => Permission,
    (permission) => permission.shareRolePermissions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;
}
