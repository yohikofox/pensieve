/**
 * Idea Repository
 * Handles CRUD operations for Idea entities
 *
 * Ideas are typically managed through ThoughtRepository,
 * but this repository provides individual idea operations
 * for specific use cases (editing, deleting individual ideas)
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Idea } from '../../domain/entities/idea.entity';

@Injectable()
export class IdeaRepository {
  private readonly logger = new Logger(IdeaRepository.name);
  private readonly ideaRepo: Repository<Idea>;

  constructor(private readonly dataSource: DataSource) {
    this.ideaRepo = this.dataSource.getRepository(Idea);
  }

  /**
   * Find Idea by ID
   *
   * @param ideaId - Idea to find
   * @returns Idea or null
   */
  async findById(ideaId: string): Promise<Idea | null> {
    return await this.ideaRepo.findOne({
      where: { id: ideaId },
      relations: ['thought'],
    });
  }

  /**
   * Find all Ideas for a user
   *
   * @param userId - User to find ideas for
   * @returns Array of Ideas
   */
  async findByUserId(userId: string): Promise<Idea[]> {
    return await this.ideaRepo.find({
      where: { ownerId: userId },
      relations: ['thought'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all Ideas for a thought
   *
   * @param thoughtId - Thought to find ideas for
   * @returns Array of Ideas ordered by orderIndex
   */
  async findByThoughtId(thoughtId: string): Promise<Idea[]> {
    return await this.ideaRepo.find({
      where: { thoughtId },
      order: { orderIndex: 'ASC' },
    });
  }

  /**
   * Create a new Idea
   *
   * @param thoughtId - Thought this idea belongs to
   * @param userId - User who owns the idea
   * @param text - Idea text
   * @param orderIndex - Optional order index
   * @returns Created Idea
   */
  async create(
    thoughtId: string,
    userId: string,
    text: string,
    orderIndex?: number,
  ): Promise<Idea> {
    const idea = this.ideaRepo.create({
      id: uuidv7(), // ADR-026 R1: UUID généré dans la couche applicative
      thoughtId,
      ownerId: userId,
      text,
      orderIndex,
      lastModifiedAt: Date.now(),
    });

    return await this.ideaRepo.save(idea);
  }

  /**
   * Update Idea text
   *
   * @param ideaId - Idea to update
   * @param text - New text
   * @returns Updated Idea
   */
  async update(ideaId: string, text: string): Promise<Idea | null> {
    const idea = await this.findById(ideaId);
    if (!idea) {
      return null;
    }

    idea.text = text;
    return await this.ideaRepo.save(idea);
  }

  /**
   * Soft-delete Idea — positionne deletedAt (ADR-026 R4)
   *
   * @param ideaId - Idea à soft-supprimer
   */
  async delete(ideaId: string): Promise<void> {
    await this.ideaRepo.softDelete(ideaId);
    this.logger.log(`🗑️  Idea soft-deleted: ${ideaId}`);
  }

  /**
   * Trouver une Idea par ID en incluant les enregistrements soft-deleted
   * Réservé aux requêtes admin/audit (AC5 ADR-026 R4)
   *
   * @param ideaId - Idea à trouver (y compris supprimées)
   * @returns Idea avec Thought ou null
   */
  async findByIdWithDeleted(ideaId: string): Promise<Idea | null> {
    return await this.ideaRepo.findOne({
      where: { id: ideaId },
      relations: ['thought'],
      withDeleted: true,
    });
  }

  /**
   * Find all Ideas (for testing/admin) — exclut les soft-deleted
   *
   * @returns All non-deleted Ideas
   */
  async findAll(): Promise<Idea[]> {
    return await this.ideaRepo.find({
      relations: ['thought'],
    });
  }

  /**
   * Find all Ideas incluant les soft-deleted — réservé admin/audit
   *
   * @returns All Ideas (actives + supprimées)
   */
  async findAllWithDeleted(): Promise<Idea[]> {
    return await this.ideaRepo.find({
      relations: ['thought'],
      withDeleted: true,
    });
  }
}
