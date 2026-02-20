import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, DataSource, Not, IsNull } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Thought } from '../../../knowledge/domain/entities/thought.entity';
import { Idea } from '../../../knowledge/domain/entities/idea.entity';
import { Todo } from '../../../action/domain/entities/todo.entity';
import { Capture } from '../../../capture/domain/entities/capture.entity';
import { CaptureSyncStatusRepository } from '../../../capture/infrastructure/repositories/capture-sync-status.repository';
import { CaptureTypeRepository } from '../../../capture/infrastructure/repositories/capture-type.repository';
import { CaptureStateRepository } from '../../../capture/infrastructure/repositories/capture-state.repository';
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
    @InjectRepository(Capture)
    private readonly captureRepository: Repository<Capture>,
    private readonly captureSyncStatusRepository: CaptureSyncStatusRepository,
    private readonly captureTypeRepository: CaptureTypeRepository,
    private readonly captureStateRepository: CaptureStateRepository,
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
      const entities = dto.entities
        ? dto.entities.split(',')
        : ['thought', 'idea', 'todo', 'captures'];

      for (const entity of entities) {
        const entityChanges = await this.getEntityChanges(
          entity,
          userId,
          lastPulledAt,
        );
        if (
          entityChanges.updated.length > 0 ||
          entityChanges.deleted.length > 0
        ) {
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
          captures: manager.getRepository(Capture),
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
    // Capture utilise des FK relations pour syncStatus — traitement spécifique
    if (entity === 'captures') {
      return this.getCaptureChanges(userId, lastPulledAt);
    }

    const repository = this.getRepository(entity);

    if (!repository) {
      this.logger.warn(`Unknown entity: ${entity}`);
      return { updated: [], deleted: [] };
    }

    // Get updated records (active = deletedAt IS NULL — filtré automatiquement par TypeORM)
    // Stories 12.3 + 13.2 : les champs _status/'syncStatus' texte ont été supprimés.
    // Le soft-delete via deletedAt (AppBaseEntity) est désormais le seul mécanisme de statut sync.
    const updated = await repository.find({
      where: {
        ownerId: userId,
        lastModifiedAt: MoreThan(lastPulledAt),
      } as any,
    });

    // Get deleted records (soft-deletes = deletedAt IS NOT NULL)
    const deleted = await repository.find({
      withDeleted: true,
      where: {
        ownerId: userId,
        lastModifiedAt: MoreThan(lastPulledAt),
        deletedAt: Not(IsNull()),
      } as any,
      select: ['id'] as any,
    });

    return {
      updated,
      deleted: deleted.map((r: any) => r.id),
    };
  }

  /**
   * Get capture changes for PULL.
   *
   * Retourne des objets plats (primitifs uniquement) pour compatibilité OP-SQLite mobile.
   * Les UUIDs de type/état sont résolus en noms via les repos cacheables (ADR-027).
   * Le mobile applique sa propre couche de conversion sur ces données (typeName → type, etc.).
   */
  private async getCaptureChanges(
    userId: string,
    lastPulledAt: number,
  ): Promise<{ updated: any[]; deleted: string[] }> {
    const [activeSyncStatus, deletedSyncStatus] = await Promise.all([
      this.captureSyncStatusRepository.findByNaturalKey('active'),
      this.captureSyncStatusRepository.findByNaturalKey('deleted'),
    ]);

    const rawUpdated = activeSyncStatus
      ? await this.captureRepository.find({
          where: {
            ownerId: userId,
            lastModifiedAt: MoreThan(lastPulledAt),
            syncStatusId: activeSyncStatus.id,
          } as any,
        })
      : [];

    // Résolution batch des UUIDs type/état via cache (ADR-027) — 0 requête si déjà en cache
    const typeIds = [...new Set(rawUpdated.map((c) => c.typeId).filter(Boolean))] as string[];
    const stateIds = [...new Set(rawUpdated.map((c) => c.stateId).filter(Boolean))] as string[];

    const [types, states] = await Promise.all([
      typeIds.length > 0 ? this.captureTypeRepository.findByIds(typeIds) : Promise.resolve([]),
      stateIds.length > 0 ? this.captureStateRepository.findByIds(stateIds) : Promise.resolve([]),
    ]);

    const typeMap = new Map(types.map((t) => [t.id, t.name]));
    const stateMap = new Map(states.map((s) => [s.id, s.name]));

    // Objets plats — primitifs uniquement, noms résolus pour la couche de conversion mobile
    const updated = rawUpdated.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      typeName: typeMap.get(c.typeId!) ?? null,
      stateName: stateMap.get(c.stateId!) ?? null,
      rawContent: c.rawContent ?? null,
      normalizedText: c.normalizedText ?? null,
      duration: c.duration ?? null,
      fileSize: c.fileSize ?? null,
      lastModifiedAt: Number(c.lastModifiedAt),
      createdAt: c.createdAt instanceof Date ? c.createdAt.getTime() : Number(c.createdAt),
    }));

    const deleted = deletedSyncStatus
      ? await this.captureRepository.find({
          where: {
            ownerId: userId,
            lastModifiedAt: MoreThan(lastPulledAt),
            syncStatusId: deletedSyncStatus.id,
          } as any,
          select: ['id', 'clientId'] as any,
        })
      : [];

    return {
      updated,
      deleted: deleted.map((r) => r.clientId), // Le mobile identifie par clientId
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
      where: { id: clientRecord.id, ownerId: userId } as any,
    });

    // New record - no conflict
    if (!serverRecord) {
      await repository.save({
        ...clientRecord,
        ownerId: userId,
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
        ownerId: userId,
      });

      return {
        conflict: true,
        strategy: resolution.strategy,
      };
    } else {
      // No conflict - accept client changes
      await repository.save({
        ...clientRecord,
        ownerId: userId,
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
      { id: recordId, ownerId: userId } as any,
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
    // Capture nécessite un traitement spécifique (clientId ≠ id backend)
    if (entity === 'captures') {
      return this.applyCapturePushInTransaction(
        userId,
        clientRecord,
        lastPulledAt,
        transactionalRepos['captures'],
      );
    }

    const repository = transactionalRepos[entity];

    if (!repository) {
      this.logger.warn(`Skipping PUSH for unsupported entity: ${entity}`);
      return { conflict: false };
    }

    // Fetch current server record
    const serverRecord = await repository.findOne({
      where: { id: clientRecord.id, ownerId: userId } as any,
    });

    // New record - no conflict
    if (!serverRecord) {
      await repository.save({
        ...clientRecord,
        ownerId: userId,
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
        ownerId: userId,
      });

      return {
        conflict: true,
        strategy: resolution.strategy,
      };
    } else {
      // No conflict - accept client changes
      await repository.save({
        ...clientRecord,
        ownerId: userId,
        last_modified_at: Date.now(),
      });

      return { conflict: false };
    }
  }

  /**
   * Applique un PUSH capture dans une transaction.
   *
   * Le mobile envoie son id local comme clientId.
   * La recherche se fait par (clientId, userId) et non (id, userId).
   * Si la capture n'existe pas → CREATE avec un nouvel UUID backend.
   */
  private async applyCapturePushInTransaction(
    userId: string,
    clientRecord: any,
    lastPulledAt: number,
    repository: Repository<any>,
  ): Promise<{ conflict: boolean; strategy?: string }> {
    if (!repository) {
      this.logger.warn('Skipping PUSH for captures: repository not available');
      return { conflict: false };
    }

    // clientRecord.id est l'ID mobile → devient clientId côté backend
    const clientId = clientRecord.id;

    const serverRecord = await repository.findOne({
      where: { clientId, ownerId: userId },
    });

    if (!serverRecord) {
      // Nouvelle capture : génère un nouvel UUID backend, stocke clientId
      // syncStatusId n'est pas fourni par le mobile — résolution via cache referentiel
      const activeSyncStatus = await this.captureSyncStatusRepository.findByNaturalKey('active');
      if (!activeSyncStatus) {
        throw new Error('capture_sync_statuses: statut "active" introuvable en base');
      }
      const { id: _mobileId, syncStatusId: _ignored, ...rest } = clientRecord;
      await repository.save({
        ...rest,
        id: uuidv7(),
        clientId,
        ownerId: userId,
        syncStatusId: activeSyncStatus.id,
        last_modified_at: Date.now(),
      });
      return { conflict: false };
    }

    // Vérifie conflit
    const hasConflict = this.conflictResolver.hasConflict(
      serverRecord,
      lastPulledAt,
    );

    if (hasConflict) {
      const resolution = await this.conflictResolver.resolve(
        serverRecord,
        clientRecord,
        'capture',
      );
      await repository.save({
        ...resolution.resolvedRecord,
        id: serverRecord.id,
        clientId: serverRecord.clientId,
        ownerId: userId,
      });
      return { conflict: true, strategy: resolution.strategy };
    } else {
      const { id: _mobileId, ...rest } = clientRecord;
      await repository.save({
        ...rest,
        id: serverRecord.id,
        clientId: serverRecord.clientId,
        ownerId: userId,
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
    // Capture : suppression soft via syncStatusId, recherche par clientId
    if (entity === 'captures') {
      const captureRepo = transactionalRepos['captures'];
      if (!captureRepo) {
        this.logger.warn(
          'Skipping DELETE for captures: repository not available',
        );
        return;
      }
      // recordId = clientId côté mobile
      const deletedStatus =
        await this.captureSyncStatusRepository.findByNaturalKey('deleted');
      if (!deletedStatus) {
        this.logger.warn('capture_sync_statuses: status "deleted" not found');
        return;
      }
      await captureRepo.update(
        { clientId: recordId, ownerId: userId } as any,
        {
          syncStatusId: deletedStatus.id,
          last_modified_at: Date.now(),
        } as any,
      );
      return;
    }

    const repository = transactionalRepos[entity];

    if (!repository) {
      this.logger.warn(`Skipping DELETE for unsupported entity: ${entity}`);
      return;
    }

    await repository.update(
      { id: recordId, ownerId: userId } as any,
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
      case 'captures':
        return this.captureRepository;
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
      count += entityChanges.updated?.length || 0;
      count += entityChanges.deleted?.length || 0;
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to log sync operation: ${errorMessage}`,
        errorStack,
      );
      // Don't throw - logging failure shouldn't break sync
    }
  }
}
