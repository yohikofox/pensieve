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

  @Column({ type: 'varchar', length: 50 })
  resourceType!: string;

  @Column('uuid')
  resourceId!: string;

  @Column('uuid')
  @Index('IDX_RESOURCE_SHARES_OWNER')
  ownerId!: string;

  @Column('uuid')
  sharedWithId!: string;

  @Column('uuid')
  shareRoleId!: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => ShareRole, (shareRole) => shareRole.resourceShares, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'shareRoleId' })
  shareRole!: ShareRole;
}
