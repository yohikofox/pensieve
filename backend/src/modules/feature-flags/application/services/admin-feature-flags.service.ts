import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Feature } from '../../domain/entities/feature.entity';
import { FeatureRepository } from '../../infrastructure/persistence/typeorm/feature.repository';
import { UserFeatureAssignmentRepository } from '../../infrastructure/persistence/typeorm/user-feature-assignment.repository';
import { RoleFeatureAssignmentRepository } from '../../infrastructure/persistence/typeorm/role-feature-assignment.repository';
import { PermissionFeatureAssignmentRepository } from '../../infrastructure/persistence/typeorm/permission-feature-assignment.repository';
import { CreateFeatureDto } from '../dtos/create-feature.dto';
import { UpdateFeatureDto } from '../dtos/update-feature.dto';

/**
 * AdminFeatureFlagsService — Logique admin pour le système de feature flags
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration
 *
 * Centralise :
 *  - CRUD catalogue features (AC1)
 *  - Features résolues utilisateur (AC2)
 *  - Assignations rôle (AC3)
 *  - Assignations permission (AC4)
 */
@Injectable()
export class AdminFeatureFlagsService {
  constructor(
    private readonly featureRepository: FeatureRepository,
    private readonly userAssignmentRepo: UserFeatureAssignmentRepository,
    private readonly roleAssignmentRepo: RoleFeatureAssignmentRepository,
    private readonly permissionAssignmentRepo: PermissionFeatureAssignmentRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ──────────────────────────────────────────────
  // Catalogue (AC1)
  // ──────────────────────────────────────────────

  listFeatures(): Promise<Feature[]> {
    return this.featureRepository.findAll();
  }

  createFeature(dto: CreateFeatureDto): Promise<Feature> {
    return this.featureRepository.create({
      key: dto.key,
      description: dto.description,
      defaultValue: dto.defaultValue,
    });
  }

  async updateFeature(id: string, dto: UpdateFeatureDto): Promise<Feature> {
    const feature = await this.featureRepository.update(id, {
      description: dto.description,
      defaultValue: dto.defaultValue,
    });
    if (!feature) throw new NotFoundException(`Feature with id '${id}' not found`);
    return feature;
  }

  // ──────────────────────────────────────────────
  // Features résolues utilisateur (AC2)
  // ──────────────────────────────────────────────

  /**
   * Retourne les features résolues (deny-wins) pour un utilisateur.
   * Format identique à GET /api/users/:userId/features — la résolution
   * est exclusivement côté backend.
   */
  async getUserFeatures(userId: string): Promise<Record<string, boolean>> {
    const allFeatures = await this.featureRepository.findAll();

    const rows: Array<{ featureKey: string; value: boolean }> =
      await this.dataSource.query(
        `SELECT f.key AS "featureKey", ufa.value
         FROM user_feature_assignments ufa
         INNER JOIN features f ON f.id = ufa.feature_id AND f.deleted_at IS NULL
         WHERE ufa.user_id = $1

         UNION ALL

         SELECT f.key AS "featureKey", rfa.value
         FROM role_feature_assignments rfa
         INNER JOIN features f ON f.id = rfa.feature_id AND f.deleted_at IS NULL
         WHERE rfa.role_id IN (
           SELECT role_id FROM user_roles
           WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
         )

         UNION ALL

         SELECT f.key AS "featureKey", pfa.value
         FROM permission_feature_assignments pfa
         INNER JOIN features f ON f.id = pfa.feature_id AND f.deleted_at IS NULL
         WHERE pfa.permission_id IN (
           SELECT permission_id FROM user_permissions WHERE user_id = $1
         )`,
        [userId],
      );

    const valueMap = new Map<string, boolean[]>();
    for (const f of allFeatures) {
      valueMap.set(f.key, []);
    }
    for (const row of rows) {
      valueMap.get(row.featureKey)?.push(row.value);
    }

    const result: Record<string, boolean> = {};
    for (const [key, values] of valueMap) {
      result[key] = values.length > 0 && values.every((v) => v);
    }
    return result;
  }

  // ──────────────────────────────────────────────
  // Assignations utilisateur (AC2)
  // ──────────────────────────────────────────────

  async upsertUserAssignment(
    userId: string,
    featureKey: string,
    value: boolean,
  ): Promise<{ key: string; value: boolean; source: string }> {
    const feature = await this.featureRepository.findByKey(featureKey);
    if (!feature) throw new NotFoundException(`Feature '${featureKey}' not found`);
    await this.userAssignmentRepo.upsert(userId, feature.id, value);
    return { key: featureKey, value, source: 'user' };
  }

  async deleteUserAssignment(userId: string, featureKey: string): Promise<void> {
    const feature = await this.featureRepository.findByKey(featureKey);
    if (!feature) throw new NotFoundException(`Feature '${featureKey}' not found`);
    await this.userAssignmentRepo.deleteAssignment(userId, feature.id);
  }

  // ──────────────────────────────────────────────
  // Assignations rôle (AC3)
  // ──────────────────────────────────────────────

  getRoleAssignments(
    roleId: string,
  ): Promise<Array<{ featureKey: string; value: boolean }>> {
    return this.roleAssignmentRepo.findByRoleId(roleId);
  }

  async upsertRoleAssignment(
    roleId: string,
    featureKey: string,
    value: boolean,
  ): Promise<{ key: string; value: boolean; source: string }> {
    const feature = await this.featureRepository.findByKey(featureKey);
    if (!feature) throw new NotFoundException(`Feature '${featureKey}' not found`);
    await this.roleAssignmentRepo.upsert(roleId, feature.id, value);
    return { key: featureKey, value, source: 'role' };
  }

  async deleteRoleAssignment(roleId: string, featureKey: string): Promise<void> {
    const feature = await this.featureRepository.findByKey(featureKey);
    if (!feature) throw new NotFoundException(`Feature '${featureKey}' not found`);
    await this.roleAssignmentRepo.deleteAssignment(roleId, feature.id);
  }

  // ──────────────────────────────────────────────
  // Assignations permission (AC4)
  // ──────────────────────────────────────────────

  getPermissionAssignments(
    permissionId: string,
  ): Promise<Array<{ featureKey: string; value: boolean }>> {
    return this.permissionAssignmentRepo.findByPermissionId(permissionId);
  }

  async upsertPermissionAssignment(
    permissionId: string,
    featureKey: string,
    value: boolean,
  ): Promise<{ key: string; value: boolean; source: string }> {
    const feature = await this.featureRepository.findByKey(featureKey);
    if (!feature) throw new NotFoundException(`Feature '${featureKey}' not found`);
    await this.permissionAssignmentRepo.upsert(permissionId, feature.id, value);
    return { key: featureKey, value, source: 'permission' };
  }

  async deletePermissionAssignment(
    permissionId: string,
    featureKey: string,
  ): Promise<void> {
    const feature = await this.featureRepository.findByKey(featureKey);
    if (!feature) throw new NotFoundException(`Feature '${featureKey}' not found`);
    await this.permissionAssignmentRepo.deleteAssignment(permissionId, feature.id);
  }
}
