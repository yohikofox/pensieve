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

  @Column('uuid')
  @Index('IDX_USER_SUBSCRIPTIONS_USER_ID')
  userId!: string;

  @Column('uuid')
  tierId!: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => SubscriptionTier, (tier) => tier.userSubscriptions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tierId' })
  tier!: SubscriptionTier;
}
