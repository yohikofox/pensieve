/**
 * Haptic Feedback Service
 * Handles haptic feedback for notification events
 *
 * Story 4.4: Notifications de Progression IA
 * Task 8: Haptic Feedback Integration (AC2, AC3)
 *
 * Covers:
 * - Subtask 8.1: Install expo-haptics module (already installed)
 * - Subtask 8.2: Implement subtle pulse haptic every 5 seconds (AC2)
 * - Subtask 8.3: Implement strong completion haptic (AC3)
 * - Subtask 8.4: Check haptic settings (AC7) before triggering
 * - Subtask 8.5: Handle platform differences (iOS vs Android haptic APIs)
 * - Subtask 8.7: Test edge case: haptic disabled in user settings
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export class HapticService {
  private hapticEnabled: boolean = true;
  private processingIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Set haptic feedback enabled/disabled
   * Subtask 8.4: Check haptic settings (AC7)
   *
   * @param enabled - Whether haptic feedback is enabled
   */
  setHapticEnabled(enabled: boolean): void {
    this.hapticEnabled = enabled;

    // Stop all processing intervals if disabled
    if (!enabled) {
      this.stopProcessingHaptics();
    }
  }

  /**
   * Check if haptic feedback is enabled
   *
   * @returns Whether haptic feedback is enabled
   */
  isHapticEnabled(): boolean {
    return this.hapticEnabled;
  }

  /**
   * Trigger subtle pulse haptic for processing
   * AC2: Subtle pulse haptic every 5 seconds
   * Subtask 8.5: Platform-specific implementation
   */
  async triggerProcessingPulse(): Promise<void> {
    if (!this.hapticEnabled) {
      return;
    }

    try {
      if (Platform.OS === 'ios') {
        // iOS: Use light impact
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (Platform.OS === 'android') {
        // Android: Use light impact (Vibration API fallback)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.warn('Failed to trigger processing haptic:', error);
    }
  }

  /**
   * Start periodic processing haptics (every 5 seconds)
   * Subtask 8.2: Implement subtle pulse haptic every 5 seconds (AC2)
   *
   * @param captureId - Capture ID for tracking
   */
  startProcessingHaptics(captureId: string): void {
    if (!this.hapticEnabled) {
      return;
    }

    // Stop any existing interval for this capture
    this.stopProcessingHaptics(captureId);

    // Trigger initial haptic
    this.triggerProcessingPulse();

    // Schedule periodic haptics every 5 seconds
    const interval = setInterval(() => {
      this.triggerProcessingPulse();
    }, 5000);

    this.processingIntervals.set(captureId, interval);
  }

  /**
   * Stop periodic processing haptics
   *
   * @param captureId - Optional capture ID. If not provided, stops all intervals.
   */
  stopProcessingHaptics(captureId?: string): void {
    if (captureId) {
      const interval = this.processingIntervals.get(captureId);
      if (interval) {
        clearInterval(interval);
        this.processingIntervals.delete(captureId);
      }
    } else {
      // Stop all intervals
      this.processingIntervals.forEach((interval) => clearInterval(interval));
      this.processingIntervals.clear();
    }
  }

  /**
   * Trigger strong completion haptic
   * AC3: Strong completion pulse
   * Subtask 8.3: Implement strong completion haptic
   */
  async triggerCompletionHaptic(): Promise<void> {
    if (!this.hapticEnabled) {
      return;
    }

    try {
      if (Platform.OS === 'ios') {
        // iOS: Use success notification haptic (strong, distinctive)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (Platform.OS === 'android') {
        // Android: Use heavy impact (closest to success haptic)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (error) {
      console.warn('Failed to trigger completion haptic:', error);
    }
  }

  /**
   * Trigger error haptic
   * AC5: Error notification haptic
   */
  async triggerErrorHaptic(): Promise<void> {
    if (!this.hapticEnabled) {
      return;
    }

    try {
      if (Platform.OS === 'ios') {
        // iOS: Use error notification haptic
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (Platform.OS === 'android') {
        // Android: Use heavy impact
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (error) {
      console.warn('Failed to trigger error haptic:', error);
    }
  }

  /**
   * Trigger warning haptic
   * AC9: Timeout warning haptic
   */
  async triggerWarningHaptic(): Promise<void> {
    if (!this.hapticEnabled) {
      return;
    }

    try {
      if (Platform.OS === 'ios') {
        // iOS: Use warning notification haptic
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (Platform.OS === 'android') {
        // Android: Use medium impact
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.warn('Failed to trigger warning haptic:', error);
    }
  }

  /**
   * Trigger selection haptic (for UI interactions)
   * Generic haptic for button presses, selections, etc.
   */
  async triggerSelectionHaptic(): Promise<void> {
    if (!this.hapticEnabled) {
      return;
    }

    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn('Failed to trigger selection haptic:', error);
    }
  }
}

// Export singleton instance
export const hapticService = new HapticService();
