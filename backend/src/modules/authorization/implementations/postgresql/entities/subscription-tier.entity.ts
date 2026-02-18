import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TierPermission } from './tier-permission.entity';
import { UserSubscription } from './user-subscription.entity';

/**
 * SubscriptionTier Entity
 * Represents available subscription plans
 */
@Entity('subscription_tiers')
export class SubscriptionTier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  name!: string;

  @Column({ name: 'price_monthly', type: 'decimal', precision: 10, scale: 2 })
  priceMonthly!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => TierPermission, (tp) => tp.tier)
  tierPermissions!: TierPermission[];

  @OneToMany(() => UserSubscription, (us) => us.tier)
  userSubscriptions!: UserSubscription[];
}
