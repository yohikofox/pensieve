/**
 * Sync Module
 * Infrastructure module for mobile ↔ backend synchronization
 *
 * Story 6.1 - Backend Sync Infrastructure
 * Implements ADR-009 sync protocol with OP-SQLite
 * Replaces WatermelonDB built-in sync (ADR-018 trade-off)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './application/controllers/sync.controller';
import { SyncService } from './application/services/sync.service';
import { SyncConflictResolver } from './infrastructure/sync-conflict-resolver';
import { SyncLog } from './domain/entities/sync-log.entity';
import { SyncConflict } from './domain/entities/sync-conflict.entity';
// Entities to sync
import { Thought } from '../knowledge/domain/entities/thought.entity';
import { Idea } from '../knowledge/domain/entities/idea.entity';
import { Todo } from '../action/domain/entities/todo.entity';
// Authorization for guards
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Sync infrastructure entities
      SyncLog,
      SyncConflict,
      // Entities to synchronize
      Thought,
      Idea,
      Todo,
      // TODO: Add Capture entity when implemented
    ]),
    AuthorizationModule, // Provides SupabaseAuthGuard
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncConflictResolver],
  exports: [SyncService], // Export for potential use in other modules
})
export class SyncModule {}
