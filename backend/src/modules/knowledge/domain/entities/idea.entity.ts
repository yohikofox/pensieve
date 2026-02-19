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
import { AppBaseEntity } from '../../../../common/entities';
import { Thought } from './thought.entity';

@Entity('ideas')
export class Idea extends AppBaseEntity {
  @Column('uuid')
  thoughtId!: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  @Column('text')
  text!: string;

  @Column({ type: 'int', nullable: true })
  orderIndex?: number; // Preserve order from GPT response (AC4)

  // Sync columns (Story 6.1)
  @Column({ type: 'bigint', name: 'last_modified_at' })
  lastModifiedAt!: number; // Milliseconds since epoch

  // Story 12.3: Soft delete via deletedAt hérité de BaseEntity (ADR-026 R4)

  // Relationships
  // ADR-026 R3 — Décision documentée : onDelete: 'CASCADE' est une contrainte FK SQL,
  // différente du cascade ORM TypeORM. Elle est intentionnellement conservée pour garantir
  // l'intégrité référentielle lors de suppressions DB directes (maintenance admin, cleanup tests).
  // Avec softDelete() TypeORM, cette contrainte n'est jamais déclenchée (UPDATE, pas DELETE SQL).
  @ManyToOne(() => Thought, (thought) => thought.ideas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thoughtId' })
  thought!: Thought;
}
