/**
 * Idea Entity
 * Individual key idea extracted from capture
 *
 * Covers Subtask 4.2: Define Idea entity schema (PostgreSQL + TypeORM)
 * AC4: Thought and Ideas Entity Creation
 *
 * Story 12.2: Extends BaseEntity (ADR-026 R1, R6)
 * - id, createdAt, updatedAt, deletedAt hérités — ne pas les redéclarer
 * - UUID généré dans la couche applicative via crypto.randomUUID()
 */

import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { Thought } from './thought.entity';

@Entity('ideas')
export class Idea extends BaseEntity {
  @Column('uuid')
  thoughtId!: string;

  @Column('uuid')
  userId!: string;

  @Column('text')
  text!: string;

  @Column({ type: 'int', nullable: true })
  orderIndex?: number; // Preserve order from GPT response (AC4)

  // Sync columns (Story 6.1)
  @Column({ type: 'bigint', name: 'last_modified_at' })
  lastModifiedAt!: number; // Milliseconds since epoch

  @Column({ type: 'text', name: '_status', default: 'active' })
  status!: string; // 'active' | 'deleted'

  // Relationships
  @ManyToOne(() => Thought, (thought) => thought.ideas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thoughtId' })
  thought!: Thought;
}
