/**
 * NotificationPreferencesStorage Tests
 * Story 4.4: Task 6.5 - Local persistence with OP-SQLite
 */

import { NotificationPreferencesStorage } from '../NotificationPreferencesStorage';
import { databaseService } from '../../database/DatabaseService';
import type { DB } from '@op-engineering/op-sqlite';

// Mock DatabaseService
jest.mock('../../database/DatabaseService', () => ({
  databaseService: {
    getDB: jest.fn(),
  },
}));

describe('NotificationPreferencesStorage', () => {
  let storage: NotificationPreferencesStorage;
  let mockDB: jest.Mocked<DB>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock database
    mockDB = {
      execute: jest.fn(),
    } as any;

    (databaseService.getDB as jest.Mock).mockReturnValue(mockDB);

    // Get fresh instance (singleton)
    storage = NotificationPreferencesStorage.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NotificationPreferencesStorage.getInstance();
      const instance2 = NotificationPreferencesStorage.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getPreferences', () => {
    it('should return preferences from database', async () => {
      mockDB.execute.mockReturnValueOnce({
        rows: {
          length: 1,
          item: (index: number) => ({
            push_notifications_enabled: 1,
            local_notifications_enabled: 0,
            haptic_feedback_enabled: 1,
            synced_at: '2026-02-05T10:00:00Z',
            updated_at: '2026-02-05T10:00:00Z',
          }),
        },
      } as any);

      const preferences = await storage.getPreferences();

      expect(preferences).toEqual({
        pushNotificationsEnabled: true,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: true,
        syncedAt: '2026-02-05T10:00:00Z',
        updatedAt: '2026-02-05T10:00:00Z',
      });

      expect(mockDB.execute).toHaveBeenCalledWith(
        'SELECT * FROM notification_preferences WHERE id = 1'
      );
    });

    it('should return null if no preferences found', async () => {
      mockDB.execute.mockReturnValueOnce({
        rows: { length: 0 },
      } as any);

      const preferences = await storage.getPreferences();

      expect(preferences).toBeNull();
    });

    it('should handle null syncedAt', async () => {
      mockDB.execute.mockReturnValueOnce({
        rows: {
          length: 1,
          item: (index: number) => ({
            push_notifications_enabled: 0,
            local_notifications_enabled: 1,
            haptic_feedback_enabled: 1,
            synced_at: null,
            updated_at: '2026-02-05T10:00:00Z',
          }),
        },
      } as any);

      const preferences = await storage.getPreferences();

      expect(preferences?.syncedAt).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockDB.execute.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await expect(storage.getPreferences()).rejects.toThrow('Database error');
    });
  });

  describe('savePreferences', () => {
    it('should save preferences to database', async () => {
      await storage.savePreferences({
        pushNotificationsEnabled: true,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: true,
        syncedAt: '2026-02-05T10:00:00Z',
      });

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notification_preferences'),
        [1, 0, 1, '2026-02-05T10:00:00Z']
      );
    });

    it('should handle null syncedAt', async () => {
      await storage.savePreferences({
        pushNotificationsEnabled: false,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: false,
        syncedAt: null,
      });

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notification_preferences'),
        [0, 1, 0, null]
      );
    });

    it('should throw error on database failure', async () => {
      mockDB.execute.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await expect(
        storage.savePreferences({
          pushNotificationsEnabled: true,
          localNotificationsEnabled: true,
          hapticFeedbackEnabled: true,
          syncedAt: null,
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('markAsSynced', () => {
    it('should update syncedAt timestamp', async () => {
      await storage.markAsSynced();

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notification_preferences')
      );
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('synced_at = datetime(\'now\')')
      );
    });

    it('should throw error on database failure', async () => {
      mockDB.execute.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await expect(storage.markAsSynced()).rejects.toThrow('Database error');
    });
  });

  describe('needsSync', () => {
    it('should return true if never synced', async () => {
      mockDB.execute.mockReturnValueOnce({
        rows: {
          length: 1,
          item: (index: number) => ({
            push_notifications_enabled: 1,
            local_notifications_enabled: 1,
            haptic_feedback_enabled: 1,
            synced_at: null,
            updated_at: '2026-02-05T10:00:00Z',
          }),
        },
      } as any);

      const needsSync = await storage.needsSync();

      expect(needsSync).toBe(true);
    });

    it('should return true if updated after sync', async () => {
      mockDB.execute.mockReturnValueOnce({
        rows: {
          length: 1,
          item: (index: number) => ({
            push_notifications_enabled: 1,
            local_notifications_enabled: 1,
            haptic_feedback_enabled: 1,
            synced_at: '2026-02-05T10:00:00Z',
            updated_at: '2026-02-05T11:00:00Z', // Updated after sync
          }),
        },
      } as any);

      const needsSync = await storage.needsSync();

      expect(needsSync).toBe(true);
    });

    it('should return false if synced and not updated after', async () => {
      mockDB.execute.mockReturnValueOnce({
        rows: {
          length: 1,
          item: (index: number) => ({
            push_notifications_enabled: 1,
            local_notifications_enabled: 1,
            haptic_feedback_enabled: 1,
            synced_at: '2026-02-05T11:00:00Z',
            updated_at: '2026-02-05T10:00:00Z', // Updated before sync
          }),
        },
      } as any);

      const needsSync = await storage.needsSync();

      expect(needsSync).toBe(false);
    });

    it('should return false if no preferences', async () => {
      mockDB.execute.mockReturnValueOnce({
        rows: { length: 0 },
      } as any);

      const needsSync = await storage.needsSync();

      expect(needsSync).toBe(false);
    });

    it('should return false on error', async () => {
      mockDB.execute.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const needsSync = await storage.needsSync();

      expect(needsSync).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to default preferences', async () => {
      await storage.reset();

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notification_preferences')
      );
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('push_notifications_enabled = 0')
      );
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('local_notifications_enabled = 1')
      );
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('haptic_feedback_enabled = 1')
      );
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('synced_at = NULL')
      );
    });

    it('should throw error on database failure', async () => {
      mockDB.execute.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await expect(storage.reset()).rejects.toThrow('Database error');
    });
  });
});
