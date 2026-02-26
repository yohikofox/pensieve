import { Injectable } from '@nestjs/common';
import { FeatureRepository } from '../../infrastructure/persistence/typeorm/feature.repository';
import { UserFeatureAssignmentRepository } from '../../infrastructure/persistence/typeorm/user-feature-assignment.repository';
import { RoleFeatureAssignmentRepository } from '../../infrastructure/persistence/typeorm/role-feature-assignment.repository';
import { PermissionFeatureAssignmentRepository } from '../../infrastructure/persistence/typeorm/permission-feature-assignment.repository';

/**
 * FeatureResolutionService — Résolution des feature flags pour un utilisateur
 * Story 24.1: Feature Flag System (AC4, AC6)
 *
 * Algorithme deny-wins :
 *   - Aucune assignation → false
 *   - Au moins une assignation à false → false (deny-wins)
 *   - Toutes les assignations à true → true
 *
 * Les 3 sources (user, role, permission) sont collectées en parallèle (AC6).
 */
@Injectable()
export class FeatureResolutionService {
  constructor(
    private readonly featureRepository: FeatureRepository,
    private readonly userAssignmentRepo: UserFeatureAssignmentRepository,
    private readonly roleAssignmentRepo: RoleFeatureAssignmentRepository,
    private readonly permissionAssignmentRepo: PermissionFeatureAssignmentRepository,
  ) {}

  async resolveFeatures(userId: string): Promise<Record<string, boolean>> {
    const [allFeatures, userAssignments, roleAssignments, permissionAssignments] =
      await Promise.all([
        this.featureRepository.findAll(),
        this.userAssignmentRepo.findByUserId(userId),
        this.roleAssignmentRepo.findByUserId(userId),
        this.permissionAssignmentRepo.findByUserId(userId),
      ]);

    // Indexer toutes les assignations par feature key
    const assignmentMap = new Map<string, boolean[]>();
    for (const feature of allFeatures) {
      assignmentMap.set(feature.key, []);
    }

    for (const a of [...userAssignments, ...roleAssignments, ...permissionAssignments]) {
      assignmentMap.get(a.featureKey)?.push(a.value);
    }

    // Résolution deny-wins
    const result: Record<string, boolean> = {};
    for (const [key, values] of assignmentMap) {
      if (values.length === 0) {
        result[key] = false; // non défini → false
      } else if (values.includes(false)) {
        result[key] = false; // deny-wins
      } else {
        result[key] = true; // tous true → true
      }
    }

    return result;
  }
}
