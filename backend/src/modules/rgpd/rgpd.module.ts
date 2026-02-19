import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RgpdController } from './infrastructure/controllers/rgpd.controller';
import { RgpdService } from './application/services/rgpd.service';
import { BetterAuthAdminService } from './application/services/better-auth-admin.service';
import { User } from '../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { AuditLog } from '../shared/infrastructure/persistence/typeorm/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog])],
  controllers: [RgpdController],
  providers: [RgpdService, BetterAuthAdminService],
  exports: [RgpdService, BetterAuthAdminService],
})
export class RgpdModule {}
