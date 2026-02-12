import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

/**
 * Migration: Create Notifications Table
 * Story 4.4: Notifications de Progression IA
 * Task 1, Subtask 1.2: Create TypeORM migration for notifications table
 *
 * Creates table for Notification Context:
 * - notifications: Local and push notifications for digestion progress
 *
 * Relations:
 * - Notification.userId → users.id (CASCADE delete)
 * - Notification.relatedEntityId → captures.id (external context, no FK)
 *
 * Indices:
 * - userId (for user isolation - NFR13)
 * - type (for notification type filtering)
 * - deliveryStatus (for delivery tracking)
 * - relatedEntityId (for capture-specific queries)
 * - createdAt (for retention policy - 30 days)
 */
export class CreateNotificationsTable1738869700000 implements MigrationInterface {
  name = 'CreateNotificationsTable1738869700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Create 'notifications' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
            comment: 'User isolation - NFR13',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment:
              'Notification type: queued, processing, completed, failed, etc.',
          },
          {
            name: 'title',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'body',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'data',
            type: 'jsonb',
            isNullable: true,
            comment: 'Custom payload (captureId, deep link, etc.)',
          },
          {
            name: 'relatedEntityId',
            type: 'uuid',
            isNullable: true,
            comment: 'captureId, thoughtId, etc.',
          },
          {
            name: 'relatedEntityType',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'capture, thought, todo, project',
          },
          {
            name: 'deliveryStatus',
            type: 'varchar',
            length: '20',
            default: "'scheduled'",
            comment: 'scheduled, sent, delivered, failed',
          },
          {
            name: 'deliveryMethod',
            type: 'varchar',
            length: '10',
            default: "'local'",
            comment: 'local, push',
          },
          {
            name: 'sentAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deliveredAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            name: 'idx_notifications_userId',
            columnNames: ['userId'],
          },
          {
            name: 'idx_notifications_type',
            columnNames: ['type'],
          },
          {
            name: 'idx_notifications_deliveryStatus',
            columnNames: ['deliveryStatus'],
          },
          {
            name: 'idx_notifications_relatedEntityId',
            columnNames: ['relatedEntityId'],
          },
          {
            name: 'idx_notifications_createdAt',
            columnNames: ['createdAt'],
          },
        ],
      }),
      true,
    );

    // ========================================
    // Add Foreign Key: userId → users.id
    // ========================================
    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'fk_notifications_userId',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key first
    await queryRunner.dropForeignKey(
      'notifications',
      'fk_notifications_userId',
    );

    // Drop table
    await queryRunner.dropTable('notifications');
  }
}
