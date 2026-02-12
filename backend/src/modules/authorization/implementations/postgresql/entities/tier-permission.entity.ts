import {
  Entity,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { SubscriptionTier } from './subscription-tier.entity';
import { Permission } from './permission.entity';

/**
 * TierPermission Entity
 * Many-to-many relation between subscription tiers and permissions
 */
@Entity('tier_permissions')
export class TierPermission {
  @PrimaryColumn('uuid')
  tierId!: string;

  @PrimaryColumn('uuid')
  permissionId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => SubscriptionTier, (tier) => tier.tierPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tierId' })
  tier!: SubscriptionTier;

  @ManyToOne(() => Permission, (permission) => permission.tierPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionId' })
  permission!: Permission;
}
