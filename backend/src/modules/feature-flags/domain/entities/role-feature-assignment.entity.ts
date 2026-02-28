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
 * RoleFeatureAssignment — Assignation de feature flag à un rôle
 * Story 24.1: Feature Flag System (AC1)
 *
 * Lie un rôle à une feature avec une valeur booléenne.
 * Contrainte UNIQUE sur (role_id, feature_id).
 */
@Entity('role_feature_assignments')
@Unique(['roleId', 'featureId'])
export class RoleFeatureAssignment {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'role_id' })
  @Index('IDX_ROLE_FEATURE_ASSIGNMENTS_ROLE_ID')
  roleId!: string;

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
