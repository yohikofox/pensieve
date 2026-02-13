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
  @PrimaryColumn({ name: 'tier_id', type: 'uuid' })
  tierId!: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => SubscriptionTier, (tier) => tier.tierPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tier_id' })
  tier!: SubscriptionTier;

  @ManyToOne(() => Permission, (permission) => permission.tierPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;
}
