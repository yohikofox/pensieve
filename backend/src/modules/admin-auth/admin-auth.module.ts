import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminUser } from './domain/entities/admin-user.entity';
import { AdminUserRepository } from './application/repositories/admin-user.repository';
import { AdminAuthService } from './application/services/admin-auth.service';
import { AdminAuthController } from './infrastructure/controllers/admin-auth.controller';
import { AdminJwtGuard } from './infrastructure/guards/admin-jwt.guard';

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
  ],
  controllers: [AdminAuthController],
  providers: [AdminUserRepository, AdminAuthService, AdminJwtGuard],
  exports: [AdminAuthService, AdminJwtGuard, JwtModule],
})
export class AdminAuthModule {}
