import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { Feature } from './feature.entity';

/**
 * UserFeatureAssignment — Assignation de feature flag à un utilisateur
 * Story 24.1: Feature Flag System (AC1)
 *
 * Lie un utilisateur à une feature avec une valeur booléenne.
 * Contrainte UNIQUE sur (user_id, feature_id).
 */
@Entity('user_feature_assignments')
@Unique(['userId', 'featureId'])
export class UserFeatureAssignment {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index('IDX_USER_FEATURE_ASSIGNMENTS_USER_ID')
  userId!: string;

  @Column({ type: 'uuid', name: 'feature_id' })
  featureId!: string;

  @ManyToOne(() => Feature, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'feature_id' })
  feature!: Feature;

  @Column({ type: 'boolean' })
  value!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
