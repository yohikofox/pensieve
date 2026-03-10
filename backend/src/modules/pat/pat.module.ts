import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalAccessToken } from './domain/entities/personal-access-token.entity';
import { PatRepository } from './infrastructure/repositories/pat.repository';
import { PatService } from './application/services/pat.service';
import { PatController } from './application/controllers/pat.controller';
import { PatGuard } from './infrastructure/guards/pat.guard';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PersonalAccessToken]),
    AuthorizationModule,
  ],
  providers: [PatRepository, PatService, PatGuard],
  controllers: [PatController],
  exports: [PatGuard, PatRepository, PatService],
})
export class PatModule {}
