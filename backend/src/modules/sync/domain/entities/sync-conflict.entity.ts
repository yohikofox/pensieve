/**
 * SyncConflict Entity
 * Audit trail for conflict resolution
 *
 * Story 6.1 - Task 4: Conflict Resolution Logic
 * AC3, AC4: Conflict resolution strategy
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('sync_conflicts')
export class SyncConflict {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('text')
  entity!: string; // captures, thoughts, ideas, todos

  @Column('uuid')
  recordId!: string; // ID of the conflicted record

  @Column('text')
  conflictType!: string; // concurrent_modification, schema_mismatch, etc.

  @Column('text')
  resolutionStrategy!: 'client_wins' | 'server_wins' | 'per_column_merge';

  @Column({ type: 'json', nullable: true })
  clientValue?: any; // Client's version of the record

  @Column({ type: 'json', nullable: true })
  serverValue?: any; // Server's version of the record

  @Column({ type: 'json', nullable: true })
  resolvedValue?: any; // Final resolved value

  @CreateDateColumn()
  resolvedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string; // Additional context
}
