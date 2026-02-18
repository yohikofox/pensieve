import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Sync Log Entity (AC7 - Sync Monitoring & Metrics)
 *
 * Tracks all sync operations for monitoring and debugging.
 * Used for metrics collection and performance analysis.
 */
@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({
    type: 'text',
    comment: 'pull or push',
  })
  syncType!: 'pull' | 'push';

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({
    type: 'int',
    nullable: true,
    comment: 'Sync duration in milliseconds',
  })
  durationMs!: number | null;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of records synced',
  })
  recordsSynced!: number;

  @Column({
    type: 'text',
    comment: 'success, error, timeout',
  })
  status!: 'success' | 'error' | 'timeout';

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Additional metadata (entities synced, conflicts, etc.)',
  })
  metadata!: Record<string, any> | null;
}
