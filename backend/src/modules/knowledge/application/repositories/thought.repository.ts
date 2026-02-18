/**
 * Thought Repository
 * Handles CRUD operations for Thought entities
 *
 * Covers:
 * - Subtask 4.3: Create ThoughtRepository with CRUD operations
 * - Subtask 4.5: Implement transaction handling for atomic Thought + Ideas creation
 * - Subtask 4.7: Add processing time logging
 *
 * AC4: Thought and Ideas Entity Creation
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Thought } from '../../domain/entities/thought.entity';
import { Idea } from '../../domain/entities/idea.entity';

@Injectable()
export class ThoughtRepository {
  private readonly logger = new Logger(ThoughtRepository.name);
  private readonly thoughtRepo: Repository<Thought>;
  private readonly ideaRepo: Repository<Idea>;

  constructor(private readonly dataSource: DataSource) {
    this.thoughtRepo = this.dataSource.getRepository(Thought);
    this.ideaRepo = this.dataSource.getRepository(Idea);
  }

  /**
   * Create Thought with associated Ideas in a single transaction
   * Subtask 4.5: Transaction handling for atomic creation
   *
   * @param captureId - Capture that was digested
   * @param userId - User who owns the capture
   * @param summary - AI-generated summary
   * @param ideas - Array of key ideas (1-10)
   * @param processingTimeMs - Time taken for digestion (AC4)
   * @param confidenceScore - Optional confidence score (AC8)
   * @returns Created Thought with Ideas
   */
  async createWithIdeas(
    captureId: string,
    userId: string,
    summary: string,
    ideas: string[],
    processingTimeMs: number,
    confidenceScore?: number,
  ): Promise<Thought> {
    this.logger.log(
      `💾 Creating Thought with ${ideas.length} ideas for capture ${captureId}`,
    );

    // Subtask 4.5: Use transaction to ensure atomic creation
    return await this.dataSource.transaction(async (manager) => {
      // ADR-026 R1: UUID généré dans la couche applicative (pas par PostgreSQL DEFAULT)
      const thoughtId = uuidv7();

      // Create Thought entity
      const thought = manager.create(Thought, {
        id: thoughtId,
        captureId,
        ownerId: userId,
        summary,
        confidenceScore,
        processingTimeMs, // Subtask 4.7: Processing time logging
        lastModifiedAt: Date.now(),
      });

      // Save Thought first to get ID
      const savedThought = await manager.save(Thought, thought);

      // Create Idea entities with orderIndex (Subtask 4.4)
      const ideaEntities = ideas.map((ideaText, index) =>
        manager.create(Idea, {
          id: uuidv7(), // ADR-026 R1: UUID généré dans la couche applicative
          thoughtId: savedThought.id,
          ownerId: userId,
          text: ideaText,
          orderIndex: index, // Preserve order from GPT response
          lastModifiedAt: Date.now(),
        }),
      );

      // Save all Ideas
      const savedIdeas = await manager.save(Idea, ideaEntities);

      // Attach Ideas to Thought for return value
      savedThought.ideas = savedIdeas;

      this.logger.log(
        `✅ Thought created: ${savedThought.id} (${ideas.length} ideas, ${processingTimeMs}ms)`,
      );

      return savedThought;
    });
  }

  /**
   * Find Thought by ID with Ideas
   *
   * @param thoughtId - Thought to find
   * @returns Thought with Ideas or null
   */
  async findById(thoughtId: string): Promise<Thought | null> {
    return await this.thoughtRepo.findOne({
      where: { id: thoughtId },
      relations: ['ideas'],
    });
  }

  /**
   * Find all Thoughts for a user
   *
   * @param userId - User to find thoughts for
   * @returns Array of Thoughts with Ideas
   */
  async findByUserId(userId: string): Promise<Thought[]> {
    return await this.thoughtRepo.find({
      where: { ownerId: userId },
      relations: ['ideas'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find Thought by Capture ID
   *
   * @param captureId - Capture to find thought for
   * @returns Thought with Ideas or null
   */
  async findByCaptureId(captureId: string): Promise<Thought | null> {
    return await this.thoughtRepo.findOne({
      where: { captureId },
      relations: ['ideas'],
    });
  }

  /**
   * Soft-delete Thought — positionne deletedAt (ADR-026 R4)
   *
   * TypeORM filtre automatiquement les enregistrements soft-deleted
   * dans les requêtes standard (find/findOne).
   * Utiliser findByIdWithDeleted() pour l'accès audit/admin.
   *
   * @param thoughtId - Thought à soft-supprimer
   */
  async delete(thoughtId: string): Promise<void> {
    await this.thoughtRepo.softDelete(thoughtId);
    this.logger.log(`🗑️  Thought soft-deleted: ${thoughtId}`);
  }

  /**
   * Trouver un Thought par ID en incluant les enregistrements soft-deleted
   * Réservé aux requêtes admin/audit (AC5 ADR-026 R4)
   *
   * @param thoughtId - Thought à trouver (y compris supprimés)
   * @returns Thought avec Ideas ou null
   */
  async findByIdWithDeleted(thoughtId: string): Promise<Thought | null> {
    return await this.thoughtRepo.findOne({
      where: { id: thoughtId },
      relations: ['ideas'],
      withDeleted: true,
    });
  }

  /**
   * Find all Thoughts (for testing/admin)
   *
   * @returns All Thoughts with Ideas
   */
  async findAll(): Promise<Thought[]> {
    return await this.thoughtRepo.find({
      relations: ['ideas'],
    });
  }
}
