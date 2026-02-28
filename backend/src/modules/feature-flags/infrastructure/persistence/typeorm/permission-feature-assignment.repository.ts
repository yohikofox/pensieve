import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AssignmentResult } from './user-feature-assignment.repository';

/**
 * PermissionFeatureAssignmentRepository — Assignations feature par permission de l'utilisateur
 * Story 24.1: Feature Flag System (AC4, AC6)
 * Story 24.2: Ajout findByPermissionId/upsert/deleteAssignment pour API admin (AC4)
 *
 * findByUserId effectue un JOIN sur user_permissions et permission_feature_assignments
 * en une seule requête SQL (pas de N+1 — AC6).
 *
 * Note: Utilise DataSource car user_permissions appartient au module Authorization
 * qui n'exporte pas son repository.
 */
@Injectable()
export class PermissionFeatureAssignmentRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findByUserId(userId: string): Promise<AssignmentResult[]> {
    const rows: Array<{ featureKey: string; value: boolean }> = await this.dataSource.query(
      `SELECT f.key AS "featureKey", pfa.value
       FROM permission_feature_assignments pfa
       INNER JOIN features f ON f.id = pfa.feature_id AND f.deleted_at IS NULL
       WHERE pfa.permission_id IN (
         SELECT permission_id
         FROM user_permissions
         WHERE user_id = $1
       )`,
      [userId],
    );
    return rows;
  }

  /**
   * Retourne toutes les assignations features d'une permission (Story 24.2 AC4)
   */
  async findByPermissionId(permissionId: string): Promise<AssignmentResult[]> {
    const rows: Array<{ featureKey: string; value: boolean }> = await this.dataSource.query(
      `SELECT f.key AS "featureKey", pfa.value
       FROM permission_feature_assignments pfa
       INNER JOIN features f ON f.id = pfa.feature_id AND f.deleted_at IS NULL
       WHERE pfa.permission_id = $1`,
      [permissionId],
    );
    return rows;
  }

  /**
   * Upsert une assignation permission → feature (Story 24.2 AC4)
   */
  async upsert(permissionId: string, featureId: string, value: boolean): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO permission_feature_assignments (id, permission_id, feature_id, value, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (permission_id, feature_id) DO UPDATE SET value = $4`,
      [crypto.randomUUID(), permissionId, featureId, value],
    );
  }

  /**
   * Supprime une assignation permission → feature (Story 24.2 AC4)
   */
  async deleteAssignment(permissionId: string, featureId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM permission_feature_assignments WHERE permission_id = $1 AND feature_id = $2`,
      [permissionId, featureId],
    );
  }
}
