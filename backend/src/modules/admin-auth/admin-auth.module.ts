import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminUser } from './domain/entities/admin-user.entity';
import { AdminUserRepository } from './application/repositories/admin-user.repository';
import { AdminAuthService } from './application/services/admin-auth.service';
import { AdminAuthController } from './infrastructure/controllers/admin-auth.controller';
import { AdminUsersController } from './infrastructure/controllers/admin-users.controller';
import { AdminJwtGuard } from './infrastructure/guards/admin-jwt.guard';
import { IdentityModule } from '../identity/identity.module';
import { RgpdModule } from '../rgpd/rgpd.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          'admin-secret-key-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    IdentityModule, // Import IdentityModule to access UserFeaturesService
    RgpdModule, // Import RgpdModule to access BetterAuthAdminService (reset password)
  ],
  controllers: [AdminAuthController, AdminUsersController],
  providers: [AdminUserRepository, AdminAuthService, AdminJwtGuard],
  exports: [AdminAuthService, AdminJwtGuard, JwtModule],
})
export class AdminAuthModule {}
