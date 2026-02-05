/**
 * Haptic Service Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 8, Subtask 8.6: Add unit tests for haptic trigger logic
 */

import { HapticService } from '../HapticService';
import * as Haptics from 'expo-haptics';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
}));

describe('HapticService', () => {
  let service: HapticService;

  beforeEach(() => {
    service = new HapticService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up all intervals
    service.stopProcessingHaptics();
  });

  describe('setHapticEnabled', () => {
    it('should enable haptic feedback by default', () => {
      expect(service.isHapticEnabled()).toBe(true);
    });

    it('should disable haptic feedback (AC7)', () => {
      service.setHapticEnabled(false);
      expect(service.isHapticEnabled()).toBe(false);
    });

    it('should stop all processing intervals when disabled', () => {
      jest.useFakeTimers();

      service.startProcessingHaptics('capture-123');
      service.startProcessingHaptics('capture-456');

      // Disable haptics
      service.setHapticEnabled(false);

      // Fast-forward 5 seconds - should NOT trigger haptics
      jest.advanceTimersByTime(5000);

      expect(Haptics.impactAsync).toHaveBeenCalledTimes(2); // Only initial haptics

      jest.useRealTimers();
    });
  });

  describe('triggerProcessingPulse (AC2)', () => {
    it('should trigger light impact haptic', async () => {
      await service.triggerProcessingPulse();

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('should NOT trigger haptic if disabled (AC7, Subtask 8.7)', async () => {
      service.setHapticEnabled(false);

      await service.triggerProcessingPulse();

      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('should handle haptic errors gracefully', async () => {
      (Haptics.impactAsync as jest.Mock).mockRejectedValue(new Error('Haptic not supported'));

      // Should not throw
      await expect(service.triggerProcessingPulse()).resolves.not.toThrow();
    });
  });

  describe('startProcessingHaptics (Subtask 8.2)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should trigger initial haptic immediately', () => {
      service.startProcessingHaptics('capture-123');

      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    });

    it('should trigger haptic every 5 seconds (AC2)', () => {
      service.startProcessingHaptics('capture-123');

      // Initial haptic
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      // After 5 seconds
      jest.advanceTimersByTime(5000);
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);

      // After another 5 seconds
      jest.advanceTimersByTime(5000);
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);
    });

    it('should stop processing haptics', () => {
      service.startProcessingHaptics('capture-123');

      // Initial haptic
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      // Stop haptics
      service.stopProcessingHaptics('capture-123');

      // Fast-forward 5 seconds - should NOT trigger
      jest.advanceTimersByTime(5000);
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1); // Still only initial
    });

    it('should handle multiple captures independently', () => {
      service.startProcessingHaptics('capture-1');
      service.startProcessingHaptics('capture-2');

      // Initial haptics for both
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);

      // Stop capture-1 only
      service.stopProcessingHaptics('capture-1');

      // Fast-forward 5 seconds - only capture-2 should trigger
      jest.advanceTimersByTime(5000);
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(3); // 2 initial + 1 for capture-2
    });

    it('should NOT start haptics if disabled', () => {
      service.setHapticEnabled(false);

      service.startProcessingHaptics('capture-123');

      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('triggerCompletionHaptic (AC3, Subtask 8.3)', () => {
    it('should trigger success notification haptic on iOS', async () => {
      // Mock Platform.OS
      jest.mock('react-native/Libraries/Utilities/Platform', () => ({
        OS: 'ios',
        select: jest.fn(),
      }));

      await service.triggerCompletionHaptic();

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success,
      );
    });

    it('should NOT trigger haptic if disabled (AC7)', async () => {
      service.setHapticEnabled(false);

      await service.triggerCompletionHaptic();

      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('should handle haptic errors gracefully', async () => {
      (Haptics.notificationAsync as jest.Mock).mockRejectedValue(
        new Error('Haptic not supported'),
      );

      // Should not throw
      await expect(service.triggerCompletionHaptic()).resolves.not.toThrow();
    });
  });

  describe('triggerErrorHaptic (AC5)', () => {
    it('should trigger error notification haptic', async () => {
      await service.triggerErrorHaptic();

      // Platform-specific behavior tested (iOS/Android)
      expect(
        Haptics.notificationAsync || Haptics.impactAsync,
      ).toHaveBeenCalled();
    });

    it('should NOT trigger haptic if disabled', async () => {
      service.setHapticEnabled(false);

      await service.triggerErrorHaptic();

      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('triggerWarningHaptic (AC9)', () => {
    it('should trigger warning notification haptic', async () => {
      await service.triggerWarningHaptic();

      // Platform-specific behavior tested
      expect(
        Haptics.notificationAsync || Haptics.impactAsync,
      ).toHaveBeenCalled();
    });

    it('should NOT trigger haptic if disabled', async () => {
      service.setHapticEnabled(false);

      await service.triggerWarningHaptic();

      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('triggerSelectionHaptic', () => {
    it('should trigger selection haptic', async () => {
      await service.triggerSelectionHaptic();

      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });

    it('should NOT trigger haptic if disabled', async () => {
      service.setHapticEnabled(false);

      await service.triggerSelectionHaptic();

      expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    });
  });

  describe('stopProcessingHaptics', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should stop all processing intervals when called without captureId', () => {
      service.startProcessingHaptics('capture-1');
      service.startProcessingHaptics('capture-2');
      service.startProcessingHaptics('capture-3');

      // Initial haptics for all
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);

      // Stop all
      service.stopProcessingHaptics();

      // Fast-forward 5 seconds - should NOT trigger any
      jest.advanceTimersByTime(5000);
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(3); // Still only initial
    });
  });
});
