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
import { SubscriptionTier } from './subscription-tier.entity';

/**
 * UserSubscription Entity
 * User subscription status and tier
 */
@Entity('user_subscriptions')
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('IDX_USER_SUBSCRIPTIONS_USER_ID')
  userId!: string;

  @Column({ name: 'tier_id', type: 'uuid' })
  tierId!: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => SubscriptionTier, (tier) => tier.userSubscriptions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tier_id' })
  tier!: SubscriptionTier;
}
