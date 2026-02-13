/**
 * SyncConflictResolver
 * Implements per-column conflict resolution strategies
 *
 * Story 6.1 - Task 4: Conflict Resolution Logic
 * Implements ADR-009.2: Per-column client-wins strategy
 */

import { Injectable, Logger } from '@nestjs/common';

export type ResolutionStrategy =
  | 'client_wins'
  | 'server_wins'
  | 'per_column_merge';

export interface ConflictResolutionResult {
  resolvedRecord: any;
  strategy: ResolutionStrategy;
  conflictType: string;
}

@Injectable()
export class SyncConflictResolver {
  private readonly logger = new Logger(SyncConflictResolver.name);

  /**
   * Resolve conflict between server and client records
   * @param entity Entity type (captures, todos, thoughts, ideas)
   * @param serverRecord Current server version
   * @param clientRecord Client's proposed update
   * @returns Resolved record with applied strategy
   */
  resolve(
    entity: string,
    serverRecord: any,
    clientRecord: any,
  ): ConflictResolutionResult {
    this.logger.debug(
      `Resolving conflict for ${entity} - record ID: ${clientRecord.id}`,
    );

    switch (entity) {
      case 'captures':
        return this.resolveCapture(serverRecord, clientRecord);

      case 'todos':
        return this.resolveTodo(serverRecord, clientRecord);

      case 'thoughts':
      case 'ideas':
      case 'projects':
        return this.resolveClientWins(entity, clientRecord);

      default:
        this.logger.warn(
          `Unknown entity type: ${entity}, defaulting to client-wins`,
        );
        return this.resolveClientWins(entity, clientRecord);
    }
  }

  /**
   * Capture conflict resolution: Per-column strategy
   * - Server wins: technical metadata (normalized_text, state)
   * - Client wins: user data (tags, projectId)
   */
  private resolveCapture(
    serverRecord: any,
    clientRecord: any,
  ): ConflictResolutionResult {
    const resolved = {
      ...clientRecord, // Start with client data (user modifications)
      // Server wins: technical metadata
      normalized_text: serverRecord.normalized_text,
      state: serverRecord.state,
      // Client wins: user data (already spread from clientRecord)
      tags: clientRecord.tags,
      projectId: clientRecord.projectId,
      // Preserve sync metadata
      last_modified_at: Date.now(),
      _status: clientRecord._status || serverRecord._status,
    };

    return {
      resolvedRecord: resolved,
      strategy: 'per_column_merge',
      conflictType: 'concurrent_modification',
    };
  }

  /**
   * Todo conflict resolution: Per-column strategy
   * - Client wins: business state (state, completed_at)
   * - Server wins: AI metadata (priority)
   */
  private resolveTodo(
    serverRecord: any,
    clientRecord: any,
  ): ConflictResolutionResult {
    const resolved = {
      ...serverRecord, // Start with server data
      // Client wins: business state
      state: clientRecord.state,
      completed_at: clientRecord.completed_at,
      // Server wins: AI-computed metadata (already from serverRecord)
      priority: serverRecord.priority,
      // Preserve sync metadata
      last_modified_at: Date.now(),
      _status: clientRecord._status || serverRecord._status,
    };

    return {
      resolvedRecord: resolved,
      strategy: 'per_column_merge',
      conflictType: 'concurrent_modification',
    };
  }

  /**
   * Default client-wins strategy for thoughts, ideas, projects
   * Client modifications take precedence
   */
  private resolveClientWins(
    entity: string,
    clientRecord: any,
  ): ConflictResolutionResult {
    return {
      resolvedRecord: {
        ...clientRecord,
        last_modified_at: Date.now(),
      },
      strategy: 'client_wins',
      conflictType: 'concurrent_modification',
    };
  }
}
