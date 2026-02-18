/**
 * ThoughtDeleteService
 * Gère la suppression explicite d'un Thought et de ses Ideas liées
 *
 * Story 12.4: Supprimer les Cascades TypeORM — ADR-026 R3
 *
 * Responsabilités :
 * - Soft-delete atomique d'un Thought et de toutes ses Ideas liées
 * - Transaction garantissant le rollback si une suppression échoue
 * - Log structuré de chaque opération pour auditabilité
 * - Retour via Result Pattern (jamais de throw applicatif)
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Thought } from '../../domain/entities/thought.entity';
import { Idea } from '../../domain/entities/idea.entity';
import {
  Result,
  success,
  transactionError,
} from '../../../../common/types/result.type';

@Injectable()
export class ThoughtDeleteService {
  private readonly logger = new Logger(ThoughtDeleteService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Soft-delete d'un Thought et de toutes ses Ideas liées dans une transaction atomique.
   *
   * ADR-026 R3 : Les suppressions en cascade sont gérées dans la couche applicative,
   * pas déléguées à TypeORM. Cela garantit :
   * - Traçabilité complète (log de chaque entité supprimée)
   * - Atomicité (rollback si une suppression échoue)
   * - Compatibilité avec le soft delete (deletedAt positionné, pas de DELETE SQL)
   *
   * @param thoughtId - Identifiant UUID du Thought à supprimer
   * @returns Result<void> — success si OK, transactionError en cas d'échec
   */
  async softDeleteWithRelated(thoughtId: string): Promise<Result<void>> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const ideaRepo = manager.getRepository(Idea);
        const thoughtRepo = manager.getRepository(Thought);

        // Trouver les Ideas non-supprimées liées au Thought
        const relatedIdeas = await ideaRepo.find({
          where: { thoughtId },
        });

        // Soft-delete les Ideas liées si elles existent
        if (relatedIdeas.length > 0) {
          const ideaIds = relatedIdeas.map((idea) => idea.id);
          await ideaRepo.softDelete(ideaIds);

          this.logger.log('thought.ideas.soft-deleted', {
            thoughtId,
            relatedIdeas: ideaIds,
            count: ideaIds.length,
          });
        }

        // Soft-delete le Thought
        await thoughtRepo.softDelete(thoughtId);

        this.logger.log('thought.soft-deleted', {
          thoughtId,
          relatedIdeasCount: relatedIdeas.length,
        });
      });

      return success(undefined);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error during deletion';

      this.logger.error('thought.delete.failed', {
        thoughtId,
        error: message,
      });

      return transactionError(
        `Failed to delete thought ${thoughtId}: ${message}`,
      );
    }
  }
}
