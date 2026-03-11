import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalAccessToken } from './domain/entities/personal-access-token.entity';
import { PATAuditLog } from './domain/entities/pat-audit-log.entity';
import { PatRepository } from './infrastructure/repositories/pat.repository';
import { PATAuditRepository } from './infrastructure/repositories/pat-audit.repository';
import { PatService } from './application/services/pat.service';
import { PATAuditService } from './application/services/pat-audit.service';
import { PatController } from './application/controllers/pat.controller';
import { PatGuard } from './infrastructure/guards/pat.guard';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PersonalAccessToken, PATAuditLog]),
    AuthorizationModule,
  ],
  providers: [
    PatRepository,
    PATAuditRepository,
    PatService,
    PATAuditService,
    PatGuard,
  ],
  controllers: [PatController],
  exports: [PatGuard, PatRepository, PatService, PATAuditService],
})
export class PatModule {}
