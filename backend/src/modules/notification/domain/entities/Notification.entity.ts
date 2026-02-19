/**
 * Notification Entity
 * Domain entity for Notification Context (Generic Subdomain)
 *
 * Story 4.4: Notifications de Progression IA
 * Task 1, Subtask 1.1: Define Notification entity schema
 *
 * Covers:
 * - AC1: Queue Status Notification
 * - AC3: Completion Notification with Preview
 * - AC5: Failure Notification with Retry
 * - AC9: Timeout Warning Notification
 *
 * Notification types: queued, processing, still_processing, completed, failed, timeout_warning, offline_queue, network_restored
 *
 * NFR13: User data isolation (notifications only for own captures)
 * NFR12: No sensitive content in push notification bodies
 */

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AppBaseEntity } from '../../../../common/entities';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';

export enum NotificationType {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  STILL_PROCESSING = 'still_processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT_WARNING = 'timeout_warning',
  OFFLINE_QUEUE = 'offline_queue',
  NETWORK_RESTORED = 'network_restored',
}

export enum DeliveryStatus {
  SCHEDULED = 'scheduled',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

export enum DeliveryMethod {
  LOCAL = 'local',
  PUSH = 'push',
}

@Entity('notifications')
@Index(['ownerId'])
@Index(['type'])
@Index(['deliveryStatus'])
@Index(['relatedEntityId'])
@Index(['createdAt'])
export class Notification extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type!: NotificationType;

  @Column('text')
  title!: string;

  @Column('text')
  body!: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  relatedEntityId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relatedEntityType?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: DeliveryStatus.SCHEDULED,
  })
  deliveryStatus!: DeliveryStatus;

  @Column({
    type: 'varchar',
    length: 10,
    default: DeliveryMethod.LOCAL,
  })
  deliveryMethod!: DeliveryMethod;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  // id, createdAt, updatedAt, deletedAt hérités de AppBaseEntity (ADR-026 R1, R4, R6)

  // Relationships
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  user!: User;
}
