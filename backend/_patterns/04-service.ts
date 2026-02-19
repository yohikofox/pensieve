/**
 * PATTERN: Application Service NestJS (ADR-023)
 *
 * Source: src/modules/knowledge/application/services/thought-delete.service.ts
 *
 * RÈGLES:
 * - @Injectable() obligatoire
 * - Logger NestJS structuré : Logger(ServiceName.name)
 * - Retourner Result<T> pour toutes les opérations critiques (ADR-023)
 * - JAMAIS throw dans un service — seul le controller throw des HttpException
 * - Logger.log() au format 'context.action' (ex: 'thought.deleted')
 * - Les opérations multi-entités se font en transaction DataSource
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Result,
  success,
  notFound,
  transactionError,
} from '../src/common/types/result.type';

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : service applicatif avec Result Pattern
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ExampleDeleteService {
  private readonly logger = new Logger(ExampleDeleteService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Soft-delete d'une entité et de ses sous-entités en transaction atomique.
   *
   * ADR-026 R3 : Les suppressions en cascade sont gérées ici,
   * pas déléguées à TypeORM.
   *
   * @param entityId - UUID de l'entité à supprimer
   * @returns Result<void>
   */
  async softDeleteWithRelated(entityId: string): Promise<Result<void>> {
    try {
      await this.dataSource.transaction(async () => {
        // 1. Trouver les sous-entités liées (avant suppression du parent)
        // const children = await childRepo.find({ where: { parentId: entityId } });

        // 2. Soft-delete les enfants d'abord
        // if (children.length > 0) {
        //   await manager.getRepository(ChildEntity).softDelete(children.map(c => c.id));
        //   this.logger.log('entity.children.soft-deleted', { entityId, count: children.length });
        // }

        // 3. Soft-delete le parent
        // await manager.getRepository(ExampleEntity).softDelete(entityId);

        await Promise.resolve(); // simulation — remplacer par les opérations réelles avec manager
        this.logger.log('entity.soft-deleted', { entityId });
      });

      return success(undefined);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error during deletion';

      this.logger.error('entity.delete.failed', { entityId, error: message });

      return transactionError(
        `Failed to delete entity ${entityId}: ${message}`,
      );
    }
  }

  /**
   * Opération avec vérification d'existence
   */
  async updateEntity(
    entityId: string,
    name: string,
  ): Promise<Result<{ id: string; name: string }>> {
    try {
      // Simulation d'une recherche
      const entity = await Promise.resolve(
        null as { id: string; name: string } | null,
      );

      if (!entity) {
        // Pas de throw — retourner notFound
        return notFound(`Entity not found: ${entityId}`);
      }

      // ... mise à jour ...

      this.logger.log('entity.updated', { entityId });
      return success({ id: entityId, name });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('entity.update.failed', { entityId, error: message });
      return transactionError(`Failed to update entity: ${message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : format de log structuré
// ─────────────────────────────────────────────────────────────────────────────
//
// this.logger.log('entity.created', { entityId, userId });       // ← succès
// this.logger.warn('entity.not-found', { entityId });            // ← warning
// this.logger.error('entity.delete.failed', { entityId, error }); // ← erreur

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDITS dans un service
// ─────────────────────────────────────────────────────────────────────────────

// ❌ throw dans un service (réservé aux controllers)
// throw new NotFoundException('Entity not found');
// throw new InternalServerErrorException('Failed');
// throw new Error('Something went wrong');

// ❌ console.log / console.error — utiliser Logger NestJS
// console.log('Entity created');
// console.error('Failed:', error);
