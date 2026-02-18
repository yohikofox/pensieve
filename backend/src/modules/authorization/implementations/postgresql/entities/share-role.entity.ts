import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ShareRolePermission } from './share-role-permission.entity';
import { ResourceShare } from './resource-share.entity';

/**
 * ShareRole Entity
 * Roles for shared resources (viewer, contributor, admin)
 */
@Entity('share_roles')
@Index('IDX_SHARE_ROLES_NAME_RESOURCE', ['name', 'resourceType'], {
  unique: true,
})
export class ShareRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 50 })
  resourceType!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => ShareRolePermission, (srp) => srp.shareRole)
  shareRolePermissions!: ShareRolePermission[];

  @OneToMany(() => ResourceShare, (rs) => rs.shareRole)
  resourceShares!: ResourceShare[];
}
