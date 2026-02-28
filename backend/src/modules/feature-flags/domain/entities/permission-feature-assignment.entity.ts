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
 * PermissionFeatureAssignment — Assignation de feature flag à une permission
 * Story 24.1: Feature Flag System (AC1)
 *
 * Lie une permission à une feature avec une valeur booléenne.
 * Contrainte UNIQUE sur (permission_id, feature_id).
 */
@Entity('permission_feature_assignments')
@Unique(['permissionId', 'featureId'])
export class PermissionFeatureAssignment {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'permission_id' })
  @Index('IDX_PERMISSION_FEATURE_ASSIGNMENTS_PERMISSION_ID')
  permissionId!: string;

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
