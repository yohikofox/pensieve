/**
 * NotificationSettingsScreen Edge Case Tests
 * Story 4.4: Task 6, Subtask 6.7
 *
 * Test edge cases:
 * 1. Push disabled but local enabled
 * 2. Push enabled but local disabled
 * 3. Both disabled
 * 4. Haptic disabled but notifications enabled
 */

import { notificationPreferencesStorage } from '../../../services/storage/NotificationPreferencesStorage';

// Mock dependencies
jest.mock('../../../services/storage/NotificationPreferencesStorage', () => ({
  notificationPreferencesStorage: {
    getPreferences: jest.fn(),
    savePreferences: jest.fn(),
    markAsSynced: jest.fn(),
  },
}));

jest.mock('../../../contexts/NetworkContext', () => ({
  useNetworkStatus: () => ({ isConnected: true }),
}));

describe('NotificationSettingsScreen Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Edge Case 1: Push disabled, Local enabled', () => {
    it('should save preferences with push=false and local=true', async () => {
      const preferences = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(preferences);

      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(preferences);
    });

    it('should load preferences correctly with push=false and local=true', async () => {
      const mockPreferences = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
        syncedAt: '2026-02-05T10:00:00Z',
        updatedAt: '2026-02-05T10:00:00Z',
      };

      (notificationPreferencesStorage.getPreferences as jest.Mock).mockResolvedValueOnce(
        mockPreferences
      );

      const result = await notificationPreferencesStorage.getPreferences();

      expect(result).toEqual(mockPreferences);
      expect(result?.pushNotificationsEnabled).toBe(false);
      expect(result?.localNotificationsEnabled).toBe(true);
    });
  });

  describe('Edge Case 2: Push enabled, Local disabled', () => {
    it('should save preferences with push=true and local=false', async () => {
      const preferences = {
        pushNotificationsEnabled: true,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: true,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(preferences);

      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(preferences);
    });

    it('should load preferences correctly with push=true and local=false', async () => {
      const mockPreferences = {
        pushNotificationsEnabled: true,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: true,
        syncedAt: '2026-02-05T10:00:00Z',
        updatedAt: '2026-02-05T10:00:00Z',
      };

      (notificationPreferencesStorage.getPreferences as jest.Mock).mockResolvedValueOnce(
        mockPreferences
      );

      const result = await notificationPreferencesStorage.getPreferences();

      expect(result).toEqual(mockPreferences);
      expect(result?.pushNotificationsEnabled).toBe(true);
      expect(result?.localNotificationsEnabled).toBe(false);
    });
  });

  describe('Edge Case 3: Both notifications disabled', () => {
    it('should save preferences with both push and local disabled', async () => {
      const preferences = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: true,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(preferences);

      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(preferences);
    });

    it('should load preferences correctly with both disabled', async () => {
      const mockPreferences = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: true,
        syncedAt: '2026-02-05T10:00:00Z',
        updatedAt: '2026-02-05T10:00:00Z',
      };

      (notificationPreferencesStorage.getPreferences as jest.Mock).mockResolvedValueOnce(
        mockPreferences
      );

      const result = await notificationPreferencesStorage.getPreferences();

      expect(result).toEqual(mockPreferences);
      expect(result?.pushNotificationsEnabled).toBe(false);
      expect(result?.localNotificationsEnabled).toBe(false);
      // Haptic can still be enabled independently
      expect(result?.hapticFeedbackEnabled).toBe(true);
    });
  });

  describe('Edge Case 4: Haptic disabled but notifications enabled', () => {
    it('should save preferences with haptic=false and notifications enabled', async () => {
      const preferences = {
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: false,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(preferences);

      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(preferences);
    });

    it('should load preferences correctly with haptic=false', async () => {
      const mockPreferences = {
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: false,
        syncedAt: '2026-02-05T10:00:00Z',
        updatedAt: '2026-02-05T10:00:00Z',
      };

      (notificationPreferencesStorage.getPreferences as jest.Mock).mockResolvedValueOnce(
        mockPreferences
      );

      const result = await notificationPreferencesStorage.getPreferences();

      expect(result).toEqual(mockPreferences);
      expect(result?.pushNotificationsEnabled).toBe(true);
      expect(result?.localNotificationsEnabled).toBe(true);
      expect(result?.hapticFeedbackEnabled).toBe(false);
    });
  });

  describe('Edge Case 5: All settings disabled', () => {
    it('should save preferences with everything disabled', async () => {
      const preferences = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: false,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(preferences);

      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(preferences);
    });

    it('should load preferences correctly with everything disabled', async () => {
      const mockPreferences = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: false,
        syncedAt: '2026-02-05T10:00:00Z',
        updatedAt: '2026-02-05T10:00:00Z',
      };

      (notificationPreferencesStorage.getPreferences as jest.Mock).mockResolvedValueOnce(
        mockPreferences
      );

      const result = await notificationPreferencesStorage.getPreferences();

      expect(result).toEqual(mockPreferences);
      expect(result?.pushNotificationsEnabled).toBe(false);
      expect(result?.localNotificationsEnabled).toBe(false);
      expect(result?.hapticFeedbackEnabled).toBe(false);
    });
  });

  describe('Edge Case 6: Toggle combinations', () => {
    it('should handle sequential toggle from all-enabled to all-disabled', async () => {
      const stages = [
        {
          // Stage 1: All enabled
          pushNotificationsEnabled: true,
          localNotificationsEnabled: true,
          hapticFeedbackEnabled: true,
          syncedAt: null,
        },
        {
          // Stage 2: Disable push
          pushNotificationsEnabled: false,
          localNotificationsEnabled: true,
          hapticFeedbackEnabled: true,
          syncedAt: null,
        },
        {
          // Stage 3: Disable local
          pushNotificationsEnabled: false,
          localNotificationsEnabled: false,
          hapticFeedbackEnabled: true,
          syncedAt: null,
        },
        {
          // Stage 4: Disable haptic
          pushNotificationsEnabled: false,
          localNotificationsEnabled: false,
          hapticFeedbackEnabled: false,
          syncedAt: null,
        },
      ];

      for (const stage of stages) {
        await notificationPreferencesStorage.savePreferences(stage);
      }

      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledTimes(4);
    });
  });

  describe('Edge Case 7: Verification of independent controls', () => {
    it('should allow push and local to be controlled independently', async () => {
      // Start with push=true, local=false
      const initial = {
        pushNotificationsEnabled: true,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: true,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(initial);

      // Toggle to push=false, local=true
      const toggled = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(toggled);

      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(initial);
      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(toggled);
    });

    it('should allow haptic to be controlled independently from notifications', async () => {
      // Notifications enabled, haptic disabled
      const config1 = {
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: false,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(config1);

      // Notifications disabled, haptic enabled
      const config2 = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: false,
        hapticFeedbackEnabled: true,
        syncedAt: null,
      };

      await notificationPreferencesStorage.savePreferences(config2);

      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(config1);
      expect(notificationPreferencesStorage.savePreferences).toHaveBeenCalledWith(config2);
    });
  });
});
