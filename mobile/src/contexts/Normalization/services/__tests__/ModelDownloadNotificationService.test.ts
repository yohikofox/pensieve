/**
 * ModelDownloadNotificationService Unit Tests
 *
 * Tests notification logic: progress debouncing, permission flow,
 * success/error notifications, channel setup, and silent error handling.
 *
 * @see ModelDownloadNotificationService.ts
 * @see Story 8.7 - Téléchargement de Modèles en Arrière-Plan
 */

import 'reflect-metadata';
import { Platform } from 'react-native';

const mockSchedule = jest.fn().mockResolvedValue('notification-id');
const mockDismiss = jest.fn().mockResolvedValue(undefined);
const mockGetPerms = jest.fn();
const mockRequestPerms = jest.fn();
const mockSetChannel = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  dismissNotificationAsync: (...args: unknown[]) => mockDismiss(...args),
  getPermissionsAsync: (...args: unknown[]) => mockGetPerms(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPerms(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
  AndroidImportance: { DEFAULT: 3 },
}));

// Helper following DeviceCapabilitiesService.test.ts pattern
function mockPlatformOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    get: () => os,
    configurable: true,
  });
}

import { ModelDownloadNotificationService } from '../ModelDownloadNotificationService';

describe('ModelDownloadNotificationService', () => {
  let service: ModelDownloadNotificationService;

  beforeEach(() => {
    mockPlatformOS('android');
    jest.clearAllMocks();
    service = new ModelDownloadNotificationService();
  });

  // ──────────────────────────────────────────────────────────────────────
  // initialize()
  // ──────────────────────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('should create Android notification channel on Android', async () => {
      mockPlatformOS('android');
      await service.initialize();
      expect(mockSetChannel).toHaveBeenCalledWith('model-downloads', expect.objectContaining({
        name: 'Téléchargements de modèles',
      }));
    });

    it('should NOT create notification channel on iOS', async () => {
      mockPlatformOS('ios');
      await service.initialize();
      expect(mockSetChannel).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // requestPermissions()
  // ──────────────────────────────────────────────────────────────────────

  describe('requestPermissions()', () => {
    it('should return true immediately when permissions already granted', async () => {
      mockGetPerms.mockResolvedValue({ status: 'granted' });
      const result = await service.requestPermissions();
      expect(result).toBe(true);
      expect(mockRequestPerms).not.toHaveBeenCalled();
    });

    it('should request permissions when status is undetermined', async () => {
      mockGetPerms.mockResolvedValue({ status: 'undetermined' });
      mockRequestPerms.mockResolvedValue({ status: 'granted' });
      const result = await service.requestPermissions();
      expect(mockRequestPerms).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when user denies permissions', async () => {
      mockGetPerms.mockResolvedValue({ status: 'denied' });
      const result = await service.requestPermissions();
      expect(result).toBe(false);
      expect(mockRequestPerms).not.toHaveBeenCalled();
    });

    it('should return false when expo-notifications throws', async () => {
      mockGetPerms.mockRejectedValue(new Error('Notifications not available'));
      const result = await service.requestPermissions();
      expect(result).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // updateProgressNotification() — debounce logic
  // ──────────────────────────────────────────────────────────────────────

  describe('updateProgressNotification()', () => {
    it('should send notification at 10 % step (Android)', async () => {
      await service.updateProgressNotification('model-a', 'Model A', 0.1);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
      expect(mockSchedule.mock.calls[0][0].content.body).toContain('10%');
    });

    it('should NOT send duplicate notification for same 10 % step', async () => {
      await service.updateProgressNotification('model-a', 'Model A', 0.1);
      await service.updateProgressNotification('model-a', 'Model A', 0.15);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
    });

    it('should send new notification when step advances to 20 %', async () => {
      await service.updateProgressNotification('model-a', 'Model A', 0.1);
      mockSchedule.mockClear();
      await service.updateProgressNotification('model-a', 'Model A', 0.2);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
    });

    it('should use model-specific identifier for Android notification', async () => {
      await service.updateProgressNotification('model-x', 'Model X', 0.3);
      const call = mockSchedule.mock.calls[0][0];
      expect(call.identifier).toBe('model-download-progress-model-x');
    });

    it('should track progress per model independently', async () => {
      await service.updateProgressNotification('model-a', 'Model A', 0.1);
      await service.updateProgressNotification('model-b', 'Model B', 0.1);
      expect(mockSchedule).toHaveBeenCalledTimes(2);
    });

    it('should do nothing on iOS', async () => {
      mockPlatformOS('ios');
      await service.updateProgressNotification('model-a', 'Model A', 0.5);
      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('should not throw when expo-notifications throws', async () => {
      mockSchedule.mockRejectedValueOnce(new Error('Schedule failed'));
      await expect(
        service.updateProgressNotification('model-a', 'Model A', 0.1)
      ).resolves.not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // dismissProgressNotification()
  // ──────────────────────────────────────────────────────────────────────

  describe('dismissProgressNotification()', () => {
    it('should dismiss Android notification with correct identifier', async () => {
      mockPlatformOS('android');
      await service.dismissProgressNotification('model-a');
      expect(mockDismiss).toHaveBeenCalledWith('model-download-progress-model-a');
    });

    it('should clear debounce state so next progress update resends', async () => {
      // Send progress at 30%
      await service.updateProgressNotification('model-a', 'Model A', 0.3);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
      mockSchedule.mockClear();

      // Dismiss clears debounce state
      await service.dismissProgressNotification('model-a');

      // Same 30% should trigger a new notification (debounce was reset)
      await service.updateProgressNotification('model-a', 'Model A', 0.3);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
    });

    it('should NOT call dismiss on iOS', async () => {
      mockPlatformOS('ios');
      await service.dismissProgressNotification('model-a');
      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // notifyDownloadSuccess()
  // ──────────────────────────────────────────────────────────────────────

  describe('notifyDownloadSuccess()', () => {
    it('should schedule a success notification with model name', async () => {
      await service.notifyDownloadSuccess('model-a', 'Qwen 1.5B', 'llm');
      expect(mockSchedule).toHaveBeenCalledTimes(1);
      const { content } = mockSchedule.mock.calls[0][0];
      expect(content.title).toBe('Modèle téléchargé');
      expect(content.body).toContain('Qwen 1.5B');
    });

    it('should embed correct screen target in notification data for llm', async () => {
      await service.notifyDownloadSuccess('model-a', 'Any Model', 'llm');
      const { data } = mockSchedule.mock.calls[0][0].content;
      expect(data.screen).toBe('llm');
      expect(data.type).toBe('model_download_success');
    });

    it('should embed correct screen target in notification data for whisper', async () => {
      await service.notifyDownloadSuccess('tiny', 'Whisper Tiny', 'whisper');
      const { data } = mockSchedule.mock.calls[0][0].content;
      expect(data.screen).toBe('whisper');
    });

    it('should not throw when expo-notifications throws', async () => {
      mockSchedule.mockRejectedValueOnce(new Error('Schedule failed'));
      await expect(
        service.notifyDownloadSuccess('model-a', 'Model A', 'llm')
      ).resolves.not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // notifyDownloadError()
  // ──────────────────────────────────────────────────────────────────────

  describe('notifyDownloadError()', () => {
    it('should schedule an error notification with retry prompt', async () => {
      await service.notifyDownloadError('model-a', 'Qwen 1.5B', 'llm');
      expect(mockSchedule).toHaveBeenCalledTimes(1);
      const { content } = mockSchedule.mock.calls[0][0];
      expect(content.title).toBe('Échec du téléchargement');
      expect(content.body).toContain('réessayer');
    });

    it('should embed error type and screen in notification data', async () => {
      await service.notifyDownloadError('tiny', 'Whisper Tiny', 'whisper');
      const { data } = mockSchedule.mock.calls[0][0].content;
      expect(data.type).toBe('model_download_error');
      expect(data.screen).toBe('whisper');
    });

    it('should not throw when expo-notifications throws', async () => {
      mockSchedule.mockRejectedValueOnce(new Error('Schedule failed'));
      await expect(
        service.notifyDownloadError('model-a', 'Model A', 'llm')
      ).resolves.not.toThrow();
    });
  });
});
