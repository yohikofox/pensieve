/**
 * Todo Entity
 * Actionable task extracted from user captures
 *
 * Story 4.3 - Subtask 2.1: Define Todo entity schema (PostgreSQL + TypeORM)
 * AC2: Todo Entity Creation in Action Context
 *
 * Action Context (Supporting Domain) - Manages actionable tasks
 * Many-to-One relationship with Thought (Knowledge Context)
 *
 * Story 12.2: Extends BaseEntity (ADR-026 R1, R6)
 * - id, createdAt, updatedAt, deletedAt hérités — ne pas les redéclarer
 * - UUID généré dans la couche applicative via crypto.randomUUID()
 */

import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AppBaseEntity } from '../../../../common/entities';
import { Thought } from '../../../knowledge/domain/entities/thought.entity';
import { Idea } from '../../../knowledge/domain/entities/idea.entity';

@Entity('todos')
export class Todo extends AppBaseEntity {
  @Column('uuid')
  thoughtId!: string;

  @Column({ type: 'uuid', nullable: true })
  ideaId?: string;

  @Column('uuid')
  captureId!: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string; // User isolation (NFR13)

  @Column('text')
  description!: string;

  @Column({
    type: 'enum',
    enum: ['todo', 'launched', 'in_progress', 'completed', 'abandoned'],
    default: 'todo',
  })
  status!: 'todo' | 'launched' | 'in_progress' | 'completed' | 'abandoned';

  @Column({ type: 'timestamptz', nullable: true })
  deadline?: Date;

  @Column({ type: 'float', nullable: true })
  deadlineConfidence?: number; // 0-1, for ambiguous dates (AC3)

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  })
  priority!: 'low' | 'medium' | 'high';

  @Column({ type: 'float', nullable: true })
  priorityConfidence?: number; // 0-1, for inferred priorities (AC4)

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  // Sync columns (Story 6.1)
  @Column({ type: 'bigint', name: 'last_modified_at' })
  lastModifiedAt!: number; // Milliseconds since epoch

  // Story 12.3: Soft delete via deletedAt hérité de BaseEntity (ADR-026 R4)

  // Relationships
  @ManyToOne(() => Thought, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thoughtId' })
  thought!: Thought;

  @ManyToOne(() => Idea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ideaId' })
  idea?: Idea;

  // Note: ManyToOne to Capture will be added when Capture Context is integrated
  // @ManyToOne(() => Capture, { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'captureId' })
  // capture: Capture;
}
