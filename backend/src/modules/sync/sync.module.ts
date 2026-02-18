import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './application/controllers/sync.controller';
import { SyncService } from './application/services/sync.service';
import { SyncConflictResolver } from './infrastructure/sync-conflict-resolver';
import { SyncLog } from './domain/entities/sync-log.entity';
import { SyncConflict } from './domain/entities/sync-conflict.entity';
import { Thought } from '../knowledge/domain/entities/thought.entity';
import { Idea } from '../knowledge/domain/entities/idea.entity';
import { Todo } from '../action/domain/entities/todo.entity';
import { Capture } from '../capture/domain/entities/capture.entity';
import { CaptureType } from '../capture/domain/entities/capture-type.entity';
import { CaptureState } from '../capture/domain/entities/capture-state.entity';
import { CaptureModule } from '../capture/capture.module';

/**
 * Sync Module (AC1 - Task 1.1)
 *
 * Provides bidirectional sync infrastructure:
 * - Pull: Server → Mobile
 * - Push: Mobile → Server (with conflict resolution)
 *
 * Architecture: DDD Layered
 * - Domain: Entities (SyncLog, SyncConflict)
 * - Application: Services (SyncService), Controllers (SyncController), DTOs
 * - Infrastructure: SyncConflictResolver
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Sync entities
      SyncLog,
      SyncConflict,
      // Business entities for sync
      Thought,
      Idea,
      Todo,
      // Capture entities (Story 6.3) — Capture, CaptureType, CaptureState via CaptureModule
      Capture,
      CaptureType,
      CaptureState,
    ]),
    CaptureModule,
    // Note: SupabaseAuthGuard is provided by @Global() SharedModule
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncConflictResolver],
  exports: [SyncService], // Export for potential use by other modules
})
export class SyncModule {}
