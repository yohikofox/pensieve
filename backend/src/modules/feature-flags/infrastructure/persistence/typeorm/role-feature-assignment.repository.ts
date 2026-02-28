import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AssignmentResult } from './user-feature-assignment.repository';

/**
 * RoleFeatureAssignmentRepository — Assignations feature par rôle actif de l'utilisateur
 * Story 24.1: Feature Flag System (AC4, AC6)
 * Story 24.2: Ajout findByRoleId/upsert/deleteAssignment pour API admin (AC3)
 *
 * findByUserId effectue un JOIN sur user_roles (filtre expiresAt) et role_feature_assignments
 * en une seule requête SQL (pas de N+1 — AC6).
 *
 * Note: Utilise DataSource car user_roles appartient au module Authorization
 * qui n'exporte pas son repository.
 */
@Injectable()
export class RoleFeatureAssignmentRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findByUserId(userId: string): Promise<AssignmentResult[]> {
    const rows: Array<{ featureKey: string; value: boolean }> = await this.dataSource.query(
      `SELECT f.key AS "featureKey", rfa.value
       FROM role_feature_assignments rfa
       INNER JOIN features f ON f.id = rfa.feature_id AND f.deleted_at IS NULL
       WHERE rfa.role_id IN (
         SELECT role_id
         FROM user_roles
         WHERE user_id = $1
           AND (expires_at IS NULL OR expires_at > NOW())
       )`,
      [userId],
    );
    return rows;
  }

  /**
   * Retourne toutes les assignations features d'un rôle (Story 24.2 AC3)
   */
  async findByRoleId(roleId: string): Promise<AssignmentResult[]> {
    const rows: Array<{ featureKey: string; value: boolean }> = await this.dataSource.query(
      `SELECT f.key AS "featureKey", rfa.value
       FROM role_feature_assignments rfa
       INNER JOIN features f ON f.id = rfa.feature_id AND f.deleted_at IS NULL
       WHERE rfa.role_id = $1`,
      [roleId],
    );
    return rows;
  }

  /**
   * Upsert une assignation role → feature (Story 24.2 AC3)
   */
  async upsert(roleId: string, featureId: string, value: boolean): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO role_feature_assignments (id, role_id, feature_id, value, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (role_id, feature_id) DO UPDATE SET value = $4`,
      [crypto.randomUUID(), roleId, featureId, value],
    );
  }

  /**
   * Supprime une assignation role → feature (Story 24.2 AC3)
   */
  async deleteAssignment(roleId: string, featureId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM role_feature_assignments WHERE role_id = $1 AND feature_id = $2`,
      [roleId, featureId],
    );
  }
}
