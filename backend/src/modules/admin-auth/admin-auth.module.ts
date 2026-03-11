import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from './domain/entities/admin-user.entity';
import { AdminUserRepository } from './application/repositories/admin-user.repository';
import { AdminAuthService } from './application/services/admin-auth.service';
import { AdminAuthController } from './infrastructure/controllers/admin-auth.controller';
import { AdminUsersController } from './infrastructure/controllers/admin-users.controller';
import { AdminGuard } from './infrastructure/guards/admin.guard';
import { IdentityModule } from '../identity/identity.module';
import { RgpdModule } from '../rgpd/rgpd.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { AdminFeaturesController } from '../feature-flags/infrastructure/controllers/admin-features.controller';
import { AdminUserFeaturesController } from '../feature-flags/infrastructure/controllers/admin-user-features.controller';
import { AdminRoleFeaturesController } from '../feature-flags/infrastructure/controllers/admin-role-features.controller';
import { AdminPermissionFeaturesController } from '../feature-flags/infrastructure/controllers/admin-permission-features.controller';
import { pool } from '../../auth/auth.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser]),
    IdentityModule, // Import IdentityModule to access UserFeaturesService
    RgpdModule, // Import RgpdModule to access BetterAuthAdminService (reset password)
    FeatureFlagsModule, // Import FeatureFlagsModule to access AdminFeatureFlagsService (Story 24.2)
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    // Story 24.2: Admin feature flag controllers
    AdminFeaturesController,
    AdminUserFeaturesController,
    AdminRoleFeaturesController,
    AdminPermissionFeaturesController,
  ],
  providers: [
    AdminUserRepository,
    AdminAuthService,
    AdminGuard,
    { provide: 'BETTER_AUTH_POOL', useValue: pool },
  ],
  exports: [AdminAuthService, AdminGuard],
})
export class AdminAuthModule {}
