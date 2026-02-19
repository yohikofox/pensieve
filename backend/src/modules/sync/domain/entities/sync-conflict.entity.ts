import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

/**
 * Sync Conflict Entity (AC4 - Task 4.5 Audit Trail)
 *
 * Logs all conflict resolutions for audit trail and debugging.
 * Helps track conflict patterns and resolution effectiveness.
 */
@Entity('sync_conflicts')
@Index(['entity', 'recordId'])
@Index(['resolvedAt'])
export class SyncConflict {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'text',
    comment: 'Entity type: capture, thought, idea, todo, project',
  })
  entity!: string;

  @Column({
    type: 'uuid',
    comment: 'ID of the conflicted record',
  })
  recordId!: string;

  @Column({
    type: 'text',
    comment:
      'Type of conflict: capture-user-vs-technical, todo-state-vs-ai, etc.',
  })
  conflictType!: string;

  @Column({
    type: 'text',
    comment: 'Strategy used: per-column-hybrid, client-wins, etc.',
  })
  resolutionStrategy!: string;

  @Column({
    type: 'jsonb',
    comment: 'Server record data at conflict time',
  })
  serverData!: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Client record data at conflict time',
  })
  clientData!: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Resolved record data after conflict resolution',
  })
  resolvedData!: Record<string, any>;

  @Column({ type: 'timestamptz' })
  resolvedAt!: Date;
}
