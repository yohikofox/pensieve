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
    // Check if users table exists
    const usersTable = await queryRunner.getTable('users');
    if (!usersTable) {
      console.log('⚠️  Users table does not exist, skipping migration');
      return;
    }

    // Add pushToken column (if not exists)
    const hasPushToken = usersTable.findColumnByName('pushToken');
    if (!hasPushToken) {
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
      console.log('✅ Added pushToken column');
    } else {
      console.log('⏭️  pushToken column already exists');
    }

    // Add pushNotificationsEnabled column (if not exists)
    const hasPushNotificationsEnabled = usersTable.findColumnByName('pushNotificationsEnabled');
    if (!hasPushNotificationsEnabled) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'pushNotificationsEnabled',
          type: 'boolean',
          default: true,
          comment: 'User opt-in/opt-out for push notifications (AC7)',
        }),
      );
      console.log('✅ Added pushNotificationsEnabled column');
    } else {
      console.log('⏭️  pushNotificationsEnabled column already exists');
    }

    // Add localNotificationsEnabled column (if not exists)
    const hasLocalNotificationsEnabled = usersTable.findColumnByName('localNotificationsEnabled');
    if (!hasLocalNotificationsEnabled) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'localNotificationsEnabled',
          type: 'boolean',
          default: true,
          comment: 'User opt-in/opt-out for local notifications (AC7)',
        }),
      );
      console.log('✅ Added localNotificationsEnabled column');
    } else {
      console.log('⏭️  localNotificationsEnabled column already exists');
    }

    // Add hapticFeedbackEnabled column (if not exists)
    const hasHapticFeedbackEnabled = usersTable.findColumnByName('hapticFeedbackEnabled');
    if (!hasHapticFeedbackEnabled) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'hapticFeedbackEnabled',
          type: 'boolean',
          default: true,
          comment: 'User opt-in/opt-out for haptic feedback (AC2, AC3, AC7)',
        }),
      );
      console.log('✅ Added hapticFeedbackEnabled column');
    } else {
      console.log('⏭️  hapticFeedbackEnabled column already exists');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'hapticFeedbackEnabled');
    await queryRunner.dropColumn('users', 'localNotificationsEnabled');
    await queryRunner.dropColumn('users', 'pushNotificationsEnabled');
    await queryRunner.dropColumn('users', 'pushToken');
  }
}
