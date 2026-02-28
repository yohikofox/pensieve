import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFeatureAssignment } from '../../../domain/entities/user-feature-assignment.entity';

export interface AssignmentResult {
  featureKey: string;
  value: boolean;
}

/**
 * UserFeatureAssignmentRepository — Assignations feature par utilisateur
 * Story 24.1: Feature Flag System (AC4)
 * Story 24.2: Ajout upsert/deleteAssignment pour API admin (AC2)
 *
 * findByUserId utilise du SQL brut avec JOIN explicite (cohérent avec
 * RoleFeatureAssignmentRepository et PermissionFeatureAssignmentRepository).
 * Le filtre `f.deleted_at IS NULL` exclut les features soft-deletées, évitant
 * le NPE TypeORM sur la relation Feature lorsqu'une feature est supprimée (AC6).
 */
@Injectable()
export class UserFeatureAssignmentRepository {
  constructor(
    @InjectRepository(UserFeatureAssignment)
    private readonly repo: Repository<UserFeatureAssignment>,
  ) {}

  async findByUserId(userId: string): Promise<AssignmentResult[]> {
    const rows: Array<{ featureKey: string; value: boolean }> = await this.repo.query(
      `SELECT f.key AS "featureKey", ufa.value
       FROM user_feature_assignments ufa
       INNER JOIN features f ON f.id = ufa.feature_id AND f.deleted_at IS NULL
       WHERE ufa.user_id = $1`,
      [userId],
    );
    return rows;
  }

  /**
   * Upsert une assignation directe user → feature (Story 24.2 AC2)
   */
  async upsert(userId: string, featureId: string, value: boolean): Promise<void> {
    await this.repo.query(
      `INSERT INTO user_feature_assignments (id, user_id, feature_id, value, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, feature_id) DO UPDATE SET value = $4`,
      [crypto.randomUUID(), userId, featureId, value],
    );
  }

  /**
   * Supprime une assignation directe user → feature (Story 24.2 AC2)
   */
  async deleteAssignment(userId: string, featureId: string): Promise<void> {
    await this.repo.query(
      `DELETE FROM user_feature_assignments WHERE user_id = $1 AND feature_id = $2`,
      [userId, featureId],
    );
  }
}
