/**
 * Thought Entity
 * Core entity in Knowledge Context containing AI-generated summary
 *
 * Covers Subtask 4.1: Define Thought entity schema (PostgreSQL + TypeORM)
 * AC4: Thought and Ideas Entity Creation
 *
 * Story 12.2: Extends BaseEntity (ADR-026 R1, R6)
 * - id, createdAt, updatedAt, deletedAt hérités — ne pas les redéclarer
 * - UUID généré dans la couche applicative via crypto.randomUUID()
 */

import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { Idea } from './idea.entity';

@Entity('thoughts')
export class Thought extends BaseEntity {
  @Column('uuid')
  captureId!: string;

  @Column('uuid')
  userId!: string;

  @Column('text')
  summary!: string;

  @Column({ type: 'float', nullable: true })
  confidenceScore?: number; // 0-1, for low confidence detection (AC8)

  @Column('int')
  processingTimeMs!: number; // Performance monitoring (AC4)

  // Sync columns (Story 6.1)
  @Column({ type: 'bigint', name: 'last_modified_at' })
  lastModifiedAt!: number; // Milliseconds since epoch

  // Story 12.3: Soft delete via deletedAt hérité de BaseEntity (ADR-026 R4)

  // Relationships
  @OneToMany(() => Idea, (idea) => idea.thought, { cascade: true })
  ideas!: Idea[];

  // Story 4.3: OneToMany relationship with Todos (Action Context)
  // Lazy import to avoid circular dependency
  // @OneToMany('Todo', 'thought', { cascade: true })
  // todos!: any[]; // Type will be Todo[] but we avoid direct import

  // Note: ManyToOne to Capture will be added when Capture Context is integrated
  // @ManyToOne(() => Capture)
  // @JoinColumn({ name: 'captureId' })
  // capture: Capture;
}
