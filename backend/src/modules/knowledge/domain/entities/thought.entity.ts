/**
 * Thought Entity
 * Core entity in Knowledge Context containing AI-generated summary
 *
 * Covers Subtask 4.1: Define Thought entity schema (PostgreSQL + TypeORM)
 * AC4: Thought and Ideas Entity Creation
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Idea } from './idea.entity';

@Entity('thoughts')
export class Thought {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

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
