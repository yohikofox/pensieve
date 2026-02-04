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
      // Create Thought entity
      const thought = manager.create(Thought, {
        captureId,
        userId,
        summary,
        confidenceScore,
        processingTimeMs, // Subtask 4.7: Processing time logging
      });

      // Save Thought first to get ID
      const savedThought = await manager.save(Thought, thought);

      // Create Idea entities with orderIndex (Subtask 4.4)
      const ideaEntities = ideas.map((ideaText, index) =>
        manager.create(Idea, {
          thoughtId: savedThought.id,
          userId,
          text: ideaText,
          orderIndex: index, // Preserve order from GPT response
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
      where: { userId },
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
   * Delete Thought (cascade deletes Ideas)
   *
   * @param thoughtId - Thought to delete
   */
  async delete(thoughtId: string): Promise<void> {
    await this.thoughtRepo.delete(thoughtId);
    this.logger.log(`🗑️  Thought deleted: ${thoughtId}`);
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
