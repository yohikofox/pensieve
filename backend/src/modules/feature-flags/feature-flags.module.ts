import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feature } from './domain/entities/feature.entity';
import { UserFeatureAssignment } from './domain/entities/user-feature-assignment.entity';
import { RoleFeatureAssignment } from './domain/entities/role-feature-assignment.entity';
import { PermissionFeatureAssignment } from './domain/entities/permission-feature-assignment.entity';
import { FeatureRepository } from './infrastructure/persistence/typeorm/feature.repository';
import { UserFeatureAssignmentRepository } from './infrastructure/persistence/typeorm/user-feature-assignment.repository';
import { RoleFeatureAssignmentRepository } from './infrastructure/persistence/typeorm/role-feature-assignment.repository';
import { PermissionFeatureAssignmentRepository } from './infrastructure/persistence/typeorm/permission-feature-assignment.repository';
import { FeatureResolutionService } from './application/services/feature-resolution.service';
import { AdminFeatureFlagsService } from './application/services/admin-feature-flags.service';

/**
 * FeatureFlagsModule — Système de feature flags générique
 * Story 24.1: Feature Flag System — Backend Data Model & Resolution Engine
 * Story 24.2: Admin API — expose AdminFeatureFlagsService pour AdminAuthModule
 *
 * Expose FeatureResolutionService pour les modules consommateurs (IdentityModule).
 * Expose AdminFeatureFlagsService pour AdminAuthModule (controllers admin).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Feature,
      UserFeatureAssignment,
      RoleFeatureAssignment,
      PermissionFeatureAssignment,
    ]),
  ],
  providers: [
    FeatureRepository,
    UserFeatureAssignmentRepository,
    RoleFeatureAssignmentRepository,
    PermissionFeatureAssignmentRepository,
    FeatureResolutionService,
    AdminFeatureFlagsService,
  ],
  exports: [FeatureResolutionService, AdminFeatureFlagsService],
})
export class FeatureFlagsModule {}
