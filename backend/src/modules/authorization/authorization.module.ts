import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

// Entities
import {
  Permission,
  Role,
  RolePermission,
  UserRole,
  UserPermission,
  SubscriptionTier,
  TierPermission,
  UserSubscription,
  ShareRole,
  ShareRolePermission,
  ResourceShare,
} from './implementations/postgresql/entities';

// Repositories
import {
  PermissionRepository,
  RoleRepository,
  UserRoleRepository,
  UserPermissionRepository,
  SubscriptionRepository,
  ResourceShareRepository,
  SubscriptionTierRepository,
  UserSubscriptionRepository,
  RolePermissionRepository,
  TierPermissionRepository,
} from './implementations/postgresql/repositories';

// Services (PostgreSQL implementation)
import { PostgreSQLAuthorizationService } from './implementations/postgresql/services/postgresql-authorization.service';
import { PostgreSQLPermissionChecker } from './implementations/postgresql/services/postgresql-permission-checker.service';
import { PostgreSQLResourceAccessControl } from './implementations/postgresql/services/postgresql-resource-access.service';

// Guards
import { PermissionGuard } from './infrastructure/guards/permission.guard';
import { ResourceOwnershipGuard } from './infrastructure/guards/resource-ownership.guard';
import { ResourceShareGuard } from './infrastructure/guards/resource-share.guard';

// Controllers
import { SubscriptionController } from './infrastructure/controllers/subscription.controller';
import { AdminController } from './infrastructure/controllers/admin.controller';

/**
 * Authorization Module
 *
 * Provides multi-level authorization system with:
 * - RBAC (Role-Based Access Control)
 * - PBAC (Permission-Based Access Control)
 * - ACL (Access Control Lists for resource sharing)
 * - Subscription-based permissions
 *
 * Architecture:
 * - Core layer: Interfaces and DTOs (implementation-agnostic)
 * - Implementation layer: PostgreSQL + TypeORM (swappable)
 * - Infrastructure layer: Guards and decorators
 *
 * To swap implementation (e.g., to a different RBAC provider):
 * 1. Create new implementation in implementations/
 * 2. Change DI bindings below (useClass)
 * 3. No changes needed in controllers or guards!
 */
@Module({
  controllers: [SubscriptionController, AdminController],
  imports: [
    AdminAuthModule,
    TypeOrmModule.forFeature([
      Permission,
      Role,
      RolePermission,
      UserRole,
      UserPermission,
      SubscriptionTier,
      TierPermission,
      UserSubscription,
      ShareRole,
      ShareRolePermission,
      ResourceShare,
    ]),
  ],
  providers: [
    // Repositories
    PermissionRepository,
    RoleRepository,
    UserRoleRepository,
    UserPermissionRepository,
    SubscriptionRepository,
    ResourceShareRepository,
    SubscriptionTierRepository,
    UserSubscriptionRepository,
    RolePermissionRepository,
    TierPermissionRepository,

    // PostgreSQL Implementation Services
    PostgreSQLAuthorizationService,
    PostgreSQLPermissionChecker,
    PostgreSQLResourceAccessControl,

    // ========================================
    // DI Bindings (SWAP POINT)
    // ========================================
    // To change authorization implementation, modify these bindings
    {
      provide: 'IAuthorizationService',
      useClass: PostgreSQLAuthorizationService,
      // Future: useClass: AlternativeAuthorizationService,
    },
    {
      provide: 'IPermissionChecker',
      useClass: PostgreSQLPermissionChecker,
    },
    {
      provide: 'IResourceAccessControl',
      useClass: PostgreSQLResourceAccessControl,
    },

    // Guards (use interfaces, not concrete implementations)
    PermissionGuard,
    ResourceOwnershipGuard,
    ResourceShareGuard,
  ],
  exports: [
    // Export interface tokens for injection in other modules
    'IAuthorizationService',
    'IPermissionChecker',
    'IResourceAccessControl',

    // Export guards for global use
    PermissionGuard,
    ResourceOwnershipGuard,
    ResourceShareGuard,

    // Export repositories for advanced use cases
    PermissionRepository,
    ResourceShareRepository,
  ],
})
export class AuthorizationModule {}
