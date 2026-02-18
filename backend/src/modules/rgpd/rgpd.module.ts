import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RgpdController } from './infrastructure/controllers/rgpd.controller';
import { RgpdService } from './application/services/rgpd.service';
import { SupabaseAdminService } from './application/services/supabase-admin.service';
import { User } from '../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { AuditLog } from '../shared/infrastructure/persistence/typeorm/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog])],
  controllers: [RgpdController],
  providers: [RgpdService, SupabaseAdminService],
  exports: [RgpdService, SupabaseAdminService],
})
export class RgpdModule {}
