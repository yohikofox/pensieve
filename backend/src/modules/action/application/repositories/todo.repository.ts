/**
 * Todo Repository
 * Handles CRUD operations for Todo entities
 *
 * Story 4.3 - Covers:
 * - Subtask 2.4: Create TodoRepository with CRUD operations
 * - Subtask 2.5: Implement transaction handling for atomic Thought + Ideas + Todos creation
 * - Subtask 2.6: Cascade delete rules (when Thought deleted → Todos deleted)
 *
 * AC2: Todo Entity Creation in Action Context
 * AC5: Multiple Actions from Single Capture (1-to-Many Relationship)
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Todo } from '../../domain/entities/todo.entity';

/**
 * Data Transfer Object for Todo creation
 */
export interface CreateTodoDto {
  thoughtId: string;
  ideaId?: string;
  captureId: string;
  ownerId: string;
  description: string;
  deadline?: Date | null;
  deadlineConfidence?: number | null;
  priority: 'low' | 'medium' | 'high';
  priorityConfidence?: number | null;
  status?: 'todo' | 'launched' | 'in_progress' | 'completed' | 'abandoned';
}

@Injectable()
export class TodoRepository {
  private readonly logger = new Logger(TodoRepository.name);
  private readonly todoRepo: Repository<Todo>;

  constructor(private readonly dataSource: DataSource) {
    this.todoRepo = this.dataSource.getRepository(Todo);
  }

  /**
   * Create a single Todo
   * Subtask 2.4: Basic CRUD operation
   *
   * @param dto - Todo creation data
   * @returns Created Todo
   */
  async create(dto: CreateTodoDto): Promise<Todo> {
    this.logger.log(
      `💾 Creating Todo for thought ${dto.thoughtId}: "${dto.description}"`,
    );

    const todo = this.todoRepo.create({
      id: uuidv7(), // ADR-026 R1: UUID généré dans la couche applicative
      thoughtId: dto.thoughtId,
      ideaId: dto.ideaId,
      captureId: dto.captureId,
      ownerId: dto.ownerId,
      description: dto.description,
      deadline: dto.deadline ?? undefined,
      deadlineConfidence: dto.deadlineConfidence ?? undefined,
      priority: dto.priority,
      priorityConfidence: dto.priorityConfidence ?? undefined,
      status: dto.status || 'todo',
      lastModifiedAt: Date.now(),
    });

    const saved = await this.todoRepo.save(todo);

    this.logger.log(`✅ Todo created: ${saved.id}`);

    return saved;
  }

  /**
   * Create multiple Todos within a transaction (used by DigestionJobConsumer)
   * Subtask 2.5: Transaction handling for atomic Thought + Ideas + Todos creation
   *
   * @param manager - EntityManager from parent transaction
   * @param dtos - Array of Todo creation data
   * @returns Array of created Todos
   */
  async createManyInTransaction(
    manager: EntityManager,
    dtos: CreateTodoDto[],
  ): Promise<Todo[]> {
    if (dtos.length === 0) {
      return [];
    }

    this.logger.log(
      `💾 Creating ${dtos.length} Todos in transaction for thought ${dtos[0].thoughtId}`,
    );

    const todos = dtos.map((dto) =>
      manager.create(Todo, {
        id: uuidv7(), // ADR-026 R1: UUID généré dans la couche applicative
        thoughtId: dto.thoughtId,
        ideaId: dto.ideaId,
        captureId: dto.captureId,
        ownerId: dto.ownerId,
        description: dto.description,
        deadline: dto.deadline ?? undefined,
        deadlineConfidence: dto.deadlineConfidence ?? undefined,
        priority: dto.priority,
        priorityConfidence: dto.priorityConfidence ?? undefined,
        status: dto.status || 'todo',
        lastModifiedAt: Date.now(),
      }),
    );

    const saved = await manager.save(Todo, todos);

    this.logger.log(`✅ ${saved.length} Todos created in transaction`);

    return saved;
  }

  /**
   * Find Todo by ID
   *
   * @param todoId - Todo to find
   * @returns Todo or null
   */
  async findById(todoId: string): Promise<Todo | null> {
    return await this.todoRepo.findOne({
      where: { id: todoId },
      relations: ['thought', 'idea'],
    });
  }

  /**
   * Find all Todos for a Thought (AC5: 1-to-Many relationship)
   * Subtask 2.4: Support querying by thoughtId
   *
   * @param thoughtId - Thought to find todos for
   * @returns Array of Todos
   */
  async findByThoughtId(thoughtId: string): Promise<Todo[]> {
    return await this.todoRepo.find({
      where: { thoughtId },
      order: { createdAt: 'ASC' }, // Preserve creation order
    });
  }

  /**
   * Find all Todos for a user
   * NFR13: User data isolation
   *
   * @param userId - User to find todos for
   * @param status - Optional status filter
   * @returns Array of Todos
   */
  async findByUserId(
    userId: string,
    status?: 'todo' | 'launched' | 'in_progress' | 'completed' | 'abandoned',
  ): Promise<Todo[]> {
    const where: any = { ownerId: userId };
    if (status) {
      where.status = status;
    }

    return await this.todoRepo.find({
      where,
      order: { deadline: 'ASC', priority: 'DESC', createdAt: 'ASC' },
      relations: ['thought'],
    });
  }

  /**
   * Find all Todos for a Capture (AC2: Source reference)
   *
   * @param captureId - Capture to find todos for
   * @returns Array of Todos
   */
  async findByCaptureId(captureId: string): Promise<Todo[]> {
    return await this.todoRepo.find({
      where: { captureId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Update Todo status
   * Subtask 2.4: CRUD update operation
   *
   * @param todoId - Todo to update
   * @param status - New status
   * @returns Updated Todo
   */
  async updateStatus(
    todoId: string,
    status: 'todo' | 'launched' | 'in_progress' | 'completed' | 'abandoned',
  ): Promise<Todo> {
    const todo = await this.todoRepo.findOne({ where: { id: todoId } });
    if (!todo) {
      throw new Error(`Todo not found: ${todoId}`);
    }

    todo.status = status;

    // Set completedAt timestamp when marking as completed
    if (status === 'completed' && !todo.completedAt) {
      todo.completedAt = new Date();
    }

    const updated = await this.todoRepo.save(todo);

    this.logger.log(`✅ Todo ${todoId} status updated: ${status}`);

    return updated;
  }

  /**
   * Update Todo deadline and/or priority
   *
   * @param todoId - Todo to update
   * @param updates - Fields to update
   * @returns Updated Todo
   */
  async update(
    todoId: string,
    updates: {
      deadline?: Date | null;
      priority?: 'low' | 'medium' | 'high';
      description?: string;
    },
  ): Promise<Todo> {
    const todo = await this.todoRepo.findOne({ where: { id: todoId } });
    if (!todo) {
      throw new Error(`Todo not found: ${todoId}`);
    }

    Object.assign(todo, updates);

    const updated = await this.todoRepo.save(todo);

    this.logger.log(`✅ Todo ${todoId} updated`);

    return updated;
  }

  /**
   * Soft-delete Todo — positionne deletedAt (ADR-026 R4)
   * AC7: False Positive Correction
   *
   * @param todoId - Todo à soft-supprimer
   */
  async delete(todoId: string): Promise<void> {
    await this.todoRepo.softDelete(todoId);
    this.logger.log(`🗑️  Todo soft-deleted: ${todoId}`);
  }

  /**
   * Trouver un Todo par ID en incluant les enregistrements soft-deleted
   * Réservé aux requêtes admin/audit (AC5 ADR-026 R4)
   *
   * @param todoId - Todo à trouver (y compris supprimés)
   * @returns Todo ou null
   */
  async findByIdWithDeleted(todoId: string): Promise<Todo | null> {
    return await this.todoRepo.findOne({
      where: { id: todoId },
      relations: ['thought', 'idea'],
      withDeleted: true,
    });
  }

  /**
   * Find Todos by deadline range
   * Useful for "this week", "overdue" queries
   *
   * @param userId - User to filter by
   * @param startDate - Start of range (inclusive)
   * @param endDate - End of range (inclusive)
   * @returns Array of Todos
   */
  async findByDeadlineRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Todo[]> {
    return await this.todoRepo
      .createQueryBuilder('todo')
      .where('todo.ownerId = :ownerId', { ownerId: userId })
      .andWhere('todo.deadline IS NOT NULL')
      .andWhere('todo.deadline >= :startDate', { startDate })
      .andWhere('todo.deadline <= :endDate', { endDate })
      .orderBy('todo.deadline', 'ASC')
      .addOrderBy('todo.priority', 'DESC')
      .getMany();
  }

  /**
   * Find all Todos (for testing/admin)
   *
   * @returns All Todos
   */
  async findAll(): Promise<Todo[]> {
    return await this.todoRepo.find({
      relations: ['thought'],
    });
  }

  /**
   * Count Todos by status for a user
   * Useful for dashboard/stats
   *
   * @param userId - User to count for
   * @returns Object with counts per status
   */
  async countByStatus(userId: string): Promise<Record<string, number>> {
    const todos = await this.todoRepo.find({
      where: { ownerId: userId },
      select: ['status'],
    });

    const counts: Record<string, number> = {
      todo: 0,
      launched: 0,
      in_progress: 0,
      completed: 0,
      abandoned: 0,
    };

    for (const todo of todos) {
      counts[todo.status]++;
    }

    return counts;
  }
}
