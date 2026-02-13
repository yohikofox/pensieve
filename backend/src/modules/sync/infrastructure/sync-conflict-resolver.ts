import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncConflict } from '../domain/entities/sync-conflict.entity';

/**
 * Conflict Resolution Strategies (ADR-009.2)
 *
 * Implements per-column client-wins hybrid strategy:
 * - captures: Server wins on technical metadata, client wins on user data
 * - todos: Client wins on business state, server wins on AI metadata
 * - thoughts, ideas, projects: Client-wins default
 */

export type SyncEntity = 'capture' | 'thought' | 'idea' | 'todo' | 'project';

export interface ConflictResolutionResult<T = any> {
  resolvedRecord: T;
  strategy: string;
  conflictType: string;
}

@Injectable()
export class SyncConflictResolver {
  private readonly logger = new Logger(SyncConflictResolver.name);

  constructor(
    @InjectRepository(SyncConflict)
    private readonly syncConflictRepository: Repository<SyncConflict>,
  ) {}

  /**
   * Resolve conflict between server and client records
   *
   * @param serverRecord - Current server record
   * @param clientRecord - Incoming client record
   * @param entity - Entity type (capture, todo, thought, etc.)
   * @returns Resolved record with conflict metadata
   */
  async resolve<T extends Record<string, any>>(
    serverRecord: T,
    clientRecord: T,
    entity: SyncEntity,
  ): Promise<ConflictResolutionResult<T>> {
    this.logger.debug(
      `Resolving conflict for ${entity} record ${serverRecord.id}`,
    );

    let resolvedRecord: T;
    let strategy: string;
    let conflictType: string;

    switch (entity) {
      case 'capture':
        resolvedRecord = this.resolveCaptureConflict(serverRecord, clientRecord);
        strategy = 'per-column-hybrid';
        conflictType = 'capture-user-vs-technical';
        break;

      case 'todo':
        resolvedRecord = this.resolveTodoConflict(serverRecord, clientRecord);
        strategy = 'per-column-hybrid';
        conflictType = 'todo-state-vs-ai';
        break;

      case 'thought':
      case 'idea':
      case 'project':
        resolvedRecord = this.resolveDefaultConflict(serverRecord, clientRecord);
        strategy = 'client-wins';
        conflictType = 'simple-client-wins';
        break;

      default:
        this.logger.warn(`Unknown entity type: ${entity}, using client-wins`);
        resolvedRecord = clientRecord;
        strategy = 'client-wins';
        conflictType = 'unknown-entity';
    }

    // Log conflict resolution to audit trail
    await this.logConflict(
      entity,
      serverRecord.id,
      conflictType,
      strategy,
      serverRecord,
      clientRecord,
      resolvedRecord,
    );

    return {
      resolvedRecord,
      strategy,
      conflictType,
    };
  }

  /**
   * Capture conflict resolution (ADR-009.2)
   *
   * Server wins: technical metadata (normalized_text, state)
   * Client wins: user data (tags, projectId)
   */
  private resolveCaptureConflict<T extends Record<string, any>>(
    serverRecord: T,
    clientRecord: T,
  ): T {
    return {
      ...clientRecord, // Start with client data

      // Server wins: technical metadata
      normalized_text: serverRecord.normalized_text,
      state: serverRecord.state,
      transcription_status: serverRecord.transcription_status,
      digest_status: serverRecord.digest_status,

      // Client wins: user data (already in clientRecord)
      // - tags
      // - projectId
      // - title (user editable)

      // Server timestamp for conflict resolution
      last_modified_at: Date.now(),
    } as T;
  }

  /**
   * Todo conflict resolution (ADR-009.2)
   *
   * Client wins: business state (state, completed_at)
   * Server wins: AI metadata (priority calculated by AI)
   */
  private resolveTodoConflict<T extends Record<string, any>>(
    serverRecord: T,
    clientRecord: T,
  ): T {
    return {
      ...serverRecord, // Start with server data

      // Client wins: business state
      state: clientRecord.state,
      completed_at: clientRecord.completed_at,
      title: clientRecord.title, // User editable
      description: clientRecord.description, // User editable

      // Server wins: AI metadata (already in serverRecord)
      // - priority (calculated by AI)
      // - suggested_due_date (calculated by AI)

      // Server timestamp for conflict resolution
      last_modified_at: Date.now(),
    } as T;
  }

  /**
   * Default conflict resolution: client-wins
   *
   * Used for thoughts, ideas, projects (simple entities)
   */
  private resolveDefaultConflict<T extends Record<string, any>>(
    serverRecord: T,
    clientRecord: T,
  ): T {
    return {
      ...clientRecord,
      // Server timestamp for conflict resolution
      last_modified_at: Date.now(),
    } as T;
  }

  /**
   * Log conflict resolution to sync_conflicts table (audit trail)
   */
  private async logConflict(
    entity: string,
    recordId: string,
    conflictType: string,
    resolutionStrategy: string,
    serverRecord: any,
    clientRecord: any,
    resolvedRecord: any,
  ): Promise<void> {
    try {
      const conflict = this.syncConflictRepository.create({
        entity,
        recordId,
        conflictType,
        resolutionStrategy,
        serverData: serverRecord,
        clientData: clientRecord,
        resolvedData: resolvedRecord,
        resolvedAt: new Date(),
      });

      await this.syncConflictRepository.save(conflict);

      this.logger.log(
        `Conflict logged: ${entity}/${recordId} resolved with ${resolutionStrategy}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to log conflict for ${entity}/${recordId}: ${errorMessage}`,
      );
      // Don't throw - logging failure shouldn't break sync
    }
  }

  /**
   * Detect if conflict exists between server and client records
   *
   * Conflict exists when:
   * - server.last_modified_at > lastPulledAt (server changed after client pulled)
   * - AND client record has local changes (_changed = true)
   */
  hasConflict(
    serverRecord: { last_modified_at: number },
    lastPulledAt: number,
  ): boolean {
    return serverRecord.last_modified_at > lastPulledAt;
  }
}
