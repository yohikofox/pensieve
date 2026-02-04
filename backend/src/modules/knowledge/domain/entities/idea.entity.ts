/**
 * Idea Entity
 * Individual key idea extracted from capture
 *
 * Covers Subtask 4.2: Define Idea entity schema (PostgreSQL + TypeORM)
 * AC4: Thought and Ideas Entity Creation
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Thought } from './thought.entity';

@Entity('ideas')
export class Idea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  thoughtId: string;

  @Column('uuid')
  userId: string;

  @Column('text')
  text: string;

  @Column({ type: 'int', nullable: true })
  orderIndex?: number; // Preserve order from GPT response (AC4)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Thought, (thought) => thought.ideas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thoughtId' })
  thought: Thought;
}
