/**
 * NotificationPreferencesStorage - Local storage for notification preferences
 *
 * Provides:
 * - Get/set notification preferences
 * - Offline-first with API sync
 * - Track sync status
 */

import { database } from '../../database';

export interface NotificationPreferences {
  pushNotificationsEnabled: boolean;
  localNotificationsEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  syncedAt: string | null;
  updatedAt: string;
}

export class NotificationPreferencesStorage {
  private static instance: NotificationPreferencesStorage;

  private constructor() {}

  static getInstance(): NotificationPreferencesStorage {
    if (!NotificationPreferencesStorage.instance) {
      NotificationPreferencesStorage.instance = new NotificationPreferencesStorage();
    }
    return NotificationPreferencesStorage.instance;
  }

  /**
   * Get notification preferences from local storage
   */
  async getPreferences(): Promise<NotificationPreferences | null> {
    try {
      const db = database.getDatabase();
      const result = db.executeSync(
        'SELECT * FROM notification_preferences WHERE id = 1'
      );

      const rows = result.rows || [];
      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        pushNotificationsEnabled: row.push_notifications_enabled === 1,
        localNotificationsEnabled: row.local_notifications_enabled === 1,
        hapticFeedbackEnabled: row.haptic_feedback_enabled === 1,
        syncedAt: row.synced_at || null,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('[NotificationPreferencesStorage] Failed to get preferences:', error);
      throw error;
    }
  }

  /**
   * Save notification preferences to local storage
   */
  async savePreferences(preferences: Omit<NotificationPreferences, 'updatedAt'>): Promise<void> {
    try {
      const db = database.getDatabase();
      db.executeSync(
        `UPDATE notification_preferences
         SET push_notifications_enabled = ?,
             local_notifications_enabled = ?,
             haptic_feedback_enabled = ?,
             synced_at = ?,
             updated_at = datetime('now')
         WHERE id = 1`,
        [
          preferences.pushNotificationsEnabled ? 1 : 0,
          preferences.localNotificationsEnabled ? 1 : 0,
          preferences.hapticFeedbackEnabled ? 1 : 0,
          preferences.syncedAt || null,
        ]
      );
    } catch (error) {
      console.error('[NotificationPreferencesStorage] Failed to save preferences:', error);
      throw error;
    }
  }

  /**
   * Mark preferences as synced with server
   */
  async markAsSynced(): Promise<void> {
    try {
      const db = database.getDatabase();
      db.executeSync(
        `UPDATE notification_preferences
         SET synced_at = datetime('now')
         WHERE id = 1`
      );
    } catch (error) {
      console.error('[NotificationPreferencesStorage] Failed to mark as synced:', error);
      throw error;
    }
  }

  /**
   * Check if preferences need sync (updated after last sync)
   */
  async needsSync(): Promise<boolean> {
    try {
      const preferences = await this.getPreferences();
      if (!preferences) return false;

      // Need sync if never synced or updated after sync
      if (!preferences.syncedAt) return true;

      const updatedAt = new Date(preferences.updatedAt);
      const syncedAt = new Date(preferences.syncedAt);
      return updatedAt > syncedAt;
    } catch (error) {
      console.error('[NotificationPreferencesStorage] Failed to check sync status:', error);
      return false;
    }
  }

  /**
   * Reset to default preferences
   */
  async reset(): Promise<void> {
    try {
      const db = database.getDatabase();
      db.executeSync(
        `UPDATE notification_preferences
         SET push_notifications_enabled = 0,
             local_notifications_enabled = 1,
             haptic_feedback_enabled = 1,
             synced_at = NULL,
             updated_at = datetime('now')
         WHERE id = 1`
      );
    } catch (error) {
      console.error('[NotificationPreferencesStorage] Failed to reset:', error);
      throw error;
    }
  }
}

export const notificationPreferencesStorage = NotificationPreferencesStorage.getInstance();
