import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Capture } from './domain/entities/capture.entity';
import { CaptureType } from './domain/entities/capture-type.entity';
import { CaptureState } from './domain/entities/capture-state.entity';
import { CaptureSyncStatus } from './domain/entities/capture-sync-status.entity';
import { CaptureTypeRepository } from './infrastructure/repositories/capture-type.repository';
import { CaptureStateRepository } from './infrastructure/repositories/capture-state.repository';
import { CaptureSyncStatusRepository } from './infrastructure/repositories/capture-sync-status.repository';

/**
 * CaptureModule (Story 6.3)
 *
 * Persiste les captures côté backend pour permettre leur restauration
 * après réinstallation de l'app (NFR6 : 0 capture perdue, jamais).
 *
 * Ce module exporte TypeOrmModule pour que SyncModule puisse injecter
 * les repositories Capture sans re-déclarer les entités.
 *
 * ADR-027: Expose les repositories référentiels cacheables pour usage cross-module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Capture,
      CaptureType,
      CaptureState,
      CaptureSyncStatus,
    ]),
  ],
  providers: [
    CaptureTypeRepository,
    CaptureStateRepository,
    CaptureSyncStatusRepository,
  ],
  exports: [
    TypeOrmModule,
    CaptureTypeRepository,
    CaptureStateRepository,
    CaptureSyncStatusRepository,
  ],
})
export class CaptureModule {}
