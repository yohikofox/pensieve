/**
 * SyncLog Entity
 * Logs every sync request/response for monitoring and debugging
 *
 * Story 6.1 - Task 6: Sync Monitoring & Logging
 * AC7: Sync Monitoring & Metrics
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('text')
  syncType!: 'pull' | 'push'; // Type of sync operation

  @CreateDateColumn()
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column('int')
  durationMs!: number; // Sync duration in milliseconds

  @Column('int')
  recordsSynced!: number; // Number of records synced

  @Column('text')
  status!: 'success' | 'error' | 'partial'; // Sync status

  @Column({ type: 'text', nullable: true })
  errorMessage?: string; // Error details if failed

  @Column({ type: 'json', nullable: true })
  metadata?: {
    // Additional sync metadata
    capturesCount?: number;
    thoughtsCount?: number;
    ideasCount?: number;
    todosCount?: number;
    conflicts?: number;
  };
}
