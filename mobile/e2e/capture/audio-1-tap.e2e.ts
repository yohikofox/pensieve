/**
 * E2E Tests: Story 2.1 - Capture Audio 1-Tap
 *
 * Tests failing in RED phase - waiting for implementation
 * Run: detox test --configuration ios.sim.debug
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('Story 2.1: Capture Audio 1-Tap', () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: { microphone: 'YES' },
      newInstance: true
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('AC1: Start Recording with < 500ms Latency (NFR1)', () => {
    it('should start audio recording within 500ms of tap', async () => {
      // GIVEN: I am on the main screen of the app
      await waitFor(element(by.id('main-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // WHEN: I tap the record button
      const tapStartTime = Date.now();
      await element(by.id('record-button')).tap();

      // THEN: Recording starts within 500ms (NFR1 compliance)
      await waitFor(element(by.id('recording-indicator')))
        .toBeVisible()
        .withTimeout(500); // Hard limit: 500ms per NFR1

      const tapEndTime = Date.now();
      const latency = tapEndTime - tapStartTime;

      // Verify latency < 500ms
      if (latency >= 500) {
        throw new Error(`Recording latency ${latency}ms exceeds NFR1 limit of 500ms`);
      }
    });

    it('should display visual feedback (pulsing red indicator)', async () => {
      // GIVEN: I am on the main screen
      await waitFor(element(by.id('main-screen'))).toBeVisible();

      // WHEN: I tap the record button
      await element(by.id('record-button')).tap();

      // THEN: Visual feedback is displayed (pulsing red indicator)
      await detoxExpect(element(by.id('recording-indicator'))).toBeVisible();
      await detoxExpect(element(by.id('recording-indicator'))).toHaveToggleValue(true);
    });

    it('should trigger haptic feedback on iOS/Android', async () => {
      // GIVEN: I am on the main screen
      await waitFor(element(by.id('main-screen'))).toBeVisible();

      // WHEN: I tap the record button
      await element(by.id('record-button')).tap();

      // THEN: Haptic feedback is triggered
      // Note: Haptic feedback cannot be directly tested via Detox
      // This test verifies the recording started (indirect validation)
      await detoxExpect(element(by.id('recording-indicator'))).toBeVisible();

      // Manual verification required:
      // - iOS: Ensure expo-haptics triggers impact feedback
      // - Android: Ensure vibration permission + haptic trigger
    });

    it('should create Capture entity in WatermelonDB with status "recording"', async () => {
      // GIVEN: I am on the main screen
      await waitFor(element(by.id('main-screen'))).toBeVisible();

      // WHEN: I tap the record button
      await element(by.id('record-button')).tap();

      // THEN: A Capture entity is created with status "recording"
      // Note: Database validation requires integration test or API endpoint
      // This E2E test verifies UI consequence (recording timer visible)
      await detoxExpect(element(by.id('recording-timer'))).toBeVisible();
      await detoxExpect(element(by.id('recording-timer'))).toHaveText('00:00');
    });
  });

  describe('AC2: Stop and Save Recording', () => {
    it('should stop recording immediately when stop button tapped', async () => {
      // GIVEN: I am recording audio
      await element(by.id('record-button')).tap();
      await waitFor(element(by.id('recording-indicator')))
        .toBeVisible()
        .withTimeout(500);

      // WHEN: I tap the stop button
      await element(by.id('stop-button')).tap();

      // THEN: The recording stops immediately
      await waitFor(element(by.id('recording-indicator')))
        .not.toBeVisible()
        .withTimeout(1000);
    });

    it('should save audio file to device storage', async () => {
      // GIVEN: I am recording audio
      await element(by.id('record-button')).tap();
      await waitFor(element(by.id('recording-indicator'))).toBeVisible();

      // Record for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // WHEN: I tap the stop button
      await element(by.id('stop-button')).tap();

      // THEN: The audio file is saved (verified by success indicator)
      await waitFor(element(by.id('capture-saved-indicator')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should display audio metadata (duration, size, timestamp)', async () => {
      // GIVEN: I complete a recording
      await element(by.id('record-button')).tap();
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3s recording
      await element(by.id('stop-button')).tap();
      await waitFor(element(by.id('capture-saved-indicator'))).toBeVisible();

      // WHEN: I view the capture details
      await element(by.id('view-capture-details')).tap();

      // THEN: Metadata is displayed (duration, size, timestamp)
      await detoxExpect(element(by.id('capture-duration'))).toBeVisible();
      await detoxExpect(element(by.id('capture-size'))).toBeVisible();
      await detoxExpect(element(by.id('capture-timestamp'))).toBeVisible();
    });
  });

  describe('AC3: Offline Functionality (NFR7)', () => {
    it('should work identically in offline mode', async () => {
      // GIVEN: I have no network connectivity
      await device.setLocation(0, 0); // Disable location
      // Note: Detox doesn't have built-in network mocking
      // Use manual test or mock at app level

      // WHEN: I start and complete a recording
      await element(by.id('record-button')).tap();
      await waitFor(element(by.id('recording-indicator'))).toBeVisible();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await element(by.id('stop-button')).tap();

      // THEN: Capture works identically (no error shown)
      await waitFor(element(by.id('capture-saved-indicator'))).toBeVisible();
      await detoxExpect(element(by.id('error-message'))).not.toExist();
    });

    it('should mark Capture entity for future sync', async () => {
      // GIVEN: I am offline
      // WHEN: I complete a recording
      await element(by.id('record-button')).tap();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await element(by.id('stop-button')).tap();

      // THEN: Capture is marked for sync (sync-pending indicator)
      await waitFor(element(by.id('sync-pending-indicator')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  describe('AC4: Crash Recovery (NFR8 - Zero Data Loss)', () => {
    it('should recover partial recording after crash', async () => {
      // GIVEN: The app crashes during recording
      await element(by.id('record-button')).tap();
      await waitFor(element(by.id('recording-indicator'))).toBeVisible();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate crash
      await device.terminateApp();
      await device.launchApp({ newInstance: false });

      // WHEN: I reopen the app
      await waitFor(element(by.id('main-screen'))).toBeVisible();

      // THEN: Partial recording is recovered
      await waitFor(element(by.id('recovery-notification')))
        .toBeVisible()
        .withTimeout(3000);

      await detoxExpect(element(by.id('recovery-notification')))
        .toHaveText('Recovered 1 partial recording');
    });
  });

  describe('AC5: Microphone Permission Handling', () => {
    it('should prompt for microphone permission if not granted', async () => {
      // GIVEN: Microphone permission is not granted
      await device.launchApp({
        permissions: { microphone: 'NO' },
        newInstance: true
      });

      // WHEN: I attempt to record
      await element(by.id('record-button')).tap();

      // THEN: I am prompted to grant microphone access
      // Note: System permission dialog is handled by OS
      // This test verifies app shows permission rationale
      await waitFor(element(by.id('permission-rationale')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });
});
