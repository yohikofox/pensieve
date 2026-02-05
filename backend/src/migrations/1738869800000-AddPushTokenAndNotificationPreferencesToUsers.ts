import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add Push Token and Notification Preferences to Users
 * Story 4.4: Notifications de Progression IA
 * Task 6, Subtask 6.1: Add notification preferences to User entity
 *
 * Adds columns to users table:
 * - pushToken: Expo push token for push notifications (AC3)
 * - pushNotificationsEnabled: User opt-in/opt-out for push (AC7)
 * - localNotificationsEnabled: User opt-in/opt-out for local (AC7)
 * - hapticFeedbackEnabled: User opt-in/opt-out for haptic (AC2, AC3, AC7)
 *
 * NFR13: User notification preferences isolated per user
 * ADR-013: Hybrid notification strategy (local + push)
 */
export class AddPushTokenAndNotificationPreferencesToUsers1738869800000
  implements MigrationInterface
{
  name = 'AddPushTokenAndNotificationPreferencesToUsers1738869800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add pushToken column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'pushToken',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Expo push token for push notifications (AC3)',
      }),
    );

    // Add pushNotificationsEnabled column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'pushNotificationsEnabled',
        type: 'boolean',
        default: true,
        comment: 'User opt-in/opt-out for push notifications (AC7)',
      }),
    );

    // Add localNotificationsEnabled column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'localNotificationsEnabled',
        type: 'boolean',
        default: true,
        comment: 'User opt-in/opt-out for local notifications (AC7)',
      }),
    );

    // Add hapticFeedbackEnabled column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'hapticFeedbackEnabled',
        type: 'boolean',
        default: true,
        comment: 'User opt-in/opt-out for haptic feedback (AC2, AC3, AC7)',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'hapticFeedbackEnabled');
    await queryRunner.dropColumn('users', 'localNotificationsEnabled');
    await queryRunner.dropColumn('users', 'pushNotificationsEnabled');
    await queryRunner.dropColumn('users', 'pushToken');
  }
}
