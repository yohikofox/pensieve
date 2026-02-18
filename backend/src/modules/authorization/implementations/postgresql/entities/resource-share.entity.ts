import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ShareRole } from './share-role.entity';

/**
 * ResourceShare Entity
 * Shared resources with access control
 */
@Entity('resource_shares')
@Index('IDX_RESOURCE_SHARES_LOOKUP', [
  'resourceType',
  'resourceId',
  'sharedWithId',
])
export class ResourceShare {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 50 })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  @Index('IDX_RESOURCE_SHARES_OWNER')
  ownerId!: string;

  @Column({ name: 'shared_with_id', type: 'uuid' })
  sharedWithId!: string;

  @Column({ name: 'share_role_id', type: 'uuid' })
  shareRoleId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => ShareRole, (shareRole) => shareRole.resourceShares, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'share_role_id' })
  shareRole!: ShareRole;
}
