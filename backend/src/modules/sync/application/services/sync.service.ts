import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, DataSource } from 'typeorm';
import { Thought } from '../../../knowledge/domain/entities/thought.entity';
import { Idea } from '../../../knowledge/domain/entities/idea.entity';
import { Todo } from '../../../action/domain/entities/todo.entity';
import { SyncLog } from '../../domain/entities/sync-log.entity';
import { SyncConflictResolver } from '../../infrastructure/sync-conflict-resolver';
import { PullRequestDto } from '../dto/pull-request.dto';
import { PushRequestDto } from '../dto/push-request.dto';
import { SyncResponseDto } from '../dto/sync-response.dto';

/**
 * Sync Service (AC1, AC4 - Tasks 1.3-1.6)
 *
 * Implements ADR-009 sync protocol:
 * - processPull: Return server changes since lastPulledAt
 * - processPush: Apply client changes with conflict resolution
 *
 * User isolation (NFR13): Always filter by userId from JWT
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Thought)
    private readonly thoughtRepository: Repository<Thought>,
    @InjectRepository(Idea)
    private readonly ideaRepository: Repository<Idea>,
    @InjectRepository(Todo)
    private readonly todoRepository: Repository<Todo>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
    private readonly conflictResolver: SyncConflictResolver,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Process PULL request: Return server changes since lastPulledAt
   *
   * ADR-009.2 Pattern:
   * - Query: WHERE last_modified_at > lastPulledAt AND user_id = userId
   * - Return: { changes: {...}, timestamp: now() }
   */
  async processPull(
    userId: string,
    dto: PullRequestDto,
  ): Promise<SyncResponseDto> {
    const startTime = Date.now();
    const lastPulledAt = dto.lastPulledAt || 0;

    this.logger.debug(
      `Processing PULL for user ${userId} since ${lastPulledAt}`,
    );

    try {
      const changes: SyncResponseDto['changes'] = {};

      // Fetch changes for each entity
      // TODO: Add Capture entity when it's created
      const entities = dto.entities ? dto.entities.split(',') : ['thought', 'idea', 'todo'];

      for (const entity of entities) {
        const entityChanges = await this.getEntityChanges(
          entity,
          userId,
          lastPulledAt,
        );
        if (entityChanges.updated.length > 0 || entityChanges.deleted.length > 0) {
          changes[entity] = entityChanges;
        }
      }

      const timestamp = Date.now();

      // Log sync operation
      await this.logSync(userId, 'pull', startTime, timestamp, {
        recordsSynced: this.countRecords(changes),
        status: 'success',
      });

      return {
        changes,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `PULL failed for user ${userId}: ${errorMessage}`,
        errorStack,
      );

      await this.logSync(userId, 'pull', startTime, Date.now(), {
        status: 'error',
        errorMessage,
      });

      throw error;
    }
  }

  /**
   * Process PUSH request: Apply client changes with conflict resolution
   *
   * ADR-009.2 Conflict Detection:
   * - IF server.last_modified_at > request.lastPulledAt → CONFLICT
   * - ELSE → Accept client changes
   */
  async processPush(
    userId: string,
    dto: PushRequestDto,
  ): Promise<SyncResponseDto> {
    const startTime = Date.now();

    this.logger.debug(
      `Processing PUSH for user ${userId} with lastPulledAt ${dto.lastPulledAt}`,
    );

    try {
      const conflicts: SyncResponseDto['conflicts'] = [];
      const serverChanges: SyncResponseDto['changes'] = {};

      // Wrap all PUSH operations in a transaction for atomicity
      await this.dataSource.transaction(async (manager) => {
        // Override repositories with transaction manager
        const transactionalRepos = {
          thought: manager.getRepository(Thought),
          idea: manager.getRepository(Idea),
          todo: manager.getRepository(Todo),
        };

        // Process each entity
        for (const [entity, entityChanges] of Object.entries(dto.changes)) {
          // Process updated records
          if (entityChanges.updated) {
            for (const clientRecord of entityChanges.updated) {
              const result = await this.applyClientUpdateInTransaction(
                entity,
                userId,
                clientRecord,
                dto.lastPulledAt,
                transactionalRepos,
              );

              if (result.conflict) {
                conflicts.push({
                  entity,
                  recordId: clientRecord.id,
                  resolution: result.strategy || 'unknown',
                });
              }
            }
          }

          // Process deleted records
          if (entityChanges.deleted) {
            for (const recordId of entityChanges.deleted) {
              await this.applyClientDeleteInTransaction(
                entity,
                userId,
                recordId,
                transactionalRepos,
              );
            }
          }
        }
      });

      // After push, fetch any server changes client needs to know about
      const pullResult = await this.processPull(userId, {
        lastPulledAt: dto.lastPulledAt,
      });

      const timestamp = Date.now();

      // Log sync operation
      await this.logSync(userId, 'push', startTime, timestamp, {
        recordsSynced: this.countRecords(dto.changes),
        status: 'success',
        conflicts: conflicts.length,
      });

      return {
        changes: pullResult.changes,
        timestamp,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `PUSH failed for user ${userId}: ${errorMessage}`,
        errorStack,
      );

      await this.logSync(userId, 'push', startTime, Date.now(), {
        status: 'error',
        errorMessage,
      });

      throw error;
    }
  }

  /**
   * Get changes for a specific entity since lastPulledAt
   */
  private async getEntityChanges(
    entity: string,
    userId: string,
    lastPulledAt: number,
  ): Promise<{ updated: any[]; deleted: string[] }> {
    const repository = this.getRepository(entity);

    if (!repository) {
      this.logger.warn(`Unknown entity: ${entity}`);
      return { updated: [], deleted: [] };
    }

    // Get updated records (active)
    const updated = await repository.find({
      where: {
        userId,
        last_modified_at: MoreThan(lastPulledAt),
        _status: 'active',
      } as any,
    });

    // Get deleted records (soft deletes)
    const deleted = await repository.find({
      where: {
        userId,
        last_modified_at: MoreThan(lastPulledAt),
        _status: 'deleted',
      } as any,
      select: ['id'] as any,
    });

    return {
      updated,
      deleted: deleted.map((r: any) => r.id),
    };
  }

  /**
   * Apply client update with conflict resolution
   */
  private async applyClientUpdate(
    entity: string,
    userId: string,
    clientRecord: any,
    lastPulledAt: number,
  ): Promise<{ conflict: boolean; strategy?: string }> {
    const repository = this.getRepository(entity);

    if (!repository) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    // Fetch current server record
    const serverRecord = await repository.findOne({
      where: { id: clientRecord.id, userId } as any,
    });

    // New record - no conflict
    if (!serverRecord) {
      await repository.save({
        ...clientRecord,
        userId,
        last_modified_at: Date.now(),
      });
      return { conflict: false };
    }

    // Check for conflict
    const hasConflict = this.conflictResolver.hasConflict(
      serverRecord,
      lastPulledAt,
    );

    if (hasConflict) {
      // Resolve conflict
      const resolution = await this.conflictResolver.resolve(
        serverRecord,
        clientRecord,
        entity as any,
      );

      await repository.save({
        ...resolution.resolvedRecord,
        userId,
      });

      return {
        conflict: true,
        strategy: resolution.strategy,
      };
    } else {
      // No conflict - accept client changes
      await repository.save({
        ...clientRecord,
        userId,
        last_modified_at: Date.now(),
      });

      return { conflict: false };
    }
  }

  /**
   * Apply client delete (soft delete)
   */
  private async applyClientDelete(
    entity: string,
    userId: string,
    recordId: string,
  ): Promise<void> {
    const repository = this.getRepository(entity);

    if (!repository) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    await repository.update(
      { id: recordId, userId } as any,
      {
        _status: 'deleted',
        last_modified_at: Date.now(),
      } as any,
    );
  }

  /**
   * Apply client update within transaction (atomicity for PUSH)
   */
  private async applyClientUpdateInTransaction(
    entity: string,
    userId: string,
    clientRecord: any,
    lastPulledAt: number,
    transactionalRepos: Record<string, Repository<any>>,
  ): Promise<{ conflict: boolean; strategy?: string }> {
    const repository = transactionalRepos[entity];

    if (!repository) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    // Fetch current server record
    const serverRecord = await repository.findOne({
      where: { id: clientRecord.id, userId } as any,
    });

    // New record - no conflict
    if (!serverRecord) {
      await repository.save({
        ...clientRecord,
        userId,
        last_modified_at: Date.now(),
      });
      return { conflict: false };
    }

    // Check for conflict
    const hasConflict = this.conflictResolver.hasConflict(
      serverRecord,
      lastPulledAt,
    );

    if (hasConflict) {
      // Resolve conflict
      const resolution = await this.conflictResolver.resolve(
        serverRecord,
        clientRecord,
        entity as any,
      );

      await repository.save({
        ...resolution.resolvedRecord,
        userId,
      });

      return {
        conflict: true,
        strategy: resolution.strategy,
      };
    } else {
      // No conflict - accept client changes
      await repository.save({
        ...clientRecord,
        userId,
        last_modified_at: Date.now(),
      });

      return { conflict: false };
    }
  }

  /**
   * Apply client delete within transaction (atomicity for PUSH)
   */
  private async applyClientDeleteInTransaction(
    entity: string,
    userId: string,
    recordId: string,
    transactionalRepos: Record<string, Repository<any>>,
  ): Promise<void> {
    const repository = transactionalRepos[entity];

    if (!repository) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    await repository.update(
      { id: recordId, userId } as any,
      {
        _status: 'deleted',
        last_modified_at: Date.now(),
      } as any,
    );
  }

  /**
   * Get repository for entity
   */
  private getRepository(entity: string): Repository<any> | null {
    switch (entity) {
      case 'thought':
        return this.thoughtRepository;
      case 'idea':
        return this.ideaRepository;
      case 'todo':
        return this.todoRepository;
      // TODO: Add Capture repository when entity is created
      default:
        return null;
    }
  }

  /**
   * Count total records in changes object
   */
  private countRecords(changes: Record<string, any>): number {
    let count = 0;
    for (const entityChanges of Object.values(changes)) {
      count += (entityChanges.updated?.length || 0);
      count += (entityChanges.deleted?.length || 0);
    }
    return count;
  }

  /**
   * Log sync operation to sync_logs table
   */
  private async logSync(
    userId: string,
    syncType: 'pull' | 'push',
    startedAt: number,
    completedAt: number,
    options: {
      recordsSynced?: number;
      status: 'success' | 'error';
      errorMessage?: string;
      conflicts?: number;
    },
  ): Promise<void> {
    try {
      const log = this.syncLogRepository.create({
        userId,
        syncType,
        startedAt: new Date(startedAt),
        completedAt: new Date(completedAt),
        durationMs: completedAt - startedAt,
        recordsSynced: options.recordsSynced || 0,
        status: options.status,
        errorMessage: options.errorMessage || null,
        metadata: {
          conflicts: options.conflicts || 0,
        },
      });

      await this.syncLogRepository.save(log);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to log sync operation: ${errorMessage}`,
        errorStack,
      );
      // Don't throw - logging failure shouldn't break sync
    }
  }
}
