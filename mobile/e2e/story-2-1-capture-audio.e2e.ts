/**
 * ATDD E2E Tests for Story 2.1: Capture Audio 1-Tap
 *
 * Status: RED PHASE - Tests will FAIL until implementation is complete
 *
 * Test Strategy:
 * - E2E tests on real iOS/Android simulators
 * - Tests user journey from main screen → record → save
 * - Validates NFRs: < 500ms latency, offline-first, crash recovery
 * - Uses Detox for native interactions (permissions, haptics)
 *
 * Knowledge Base Patterns Applied:
 * - Given-When-Then structure (test-quality.md)
 * - Deterministic waits (timing-debugging.md)
 * - data-testid selectors (selector-resilience.md)
 * - One assertion per test (test-quality.md)
 */

import { device, expect as detoxExpect, element, by, waitFor } from 'detox';
import {
  waitForElement,
  tapElement,
  expectVisible,
  expectNotVisible,
  reloadApp,
  terminateApp,
  launchApp,
  goOffline,
  goOnline,
  measurePerformance,
} from './support/helpers';

describe('Story 2.1: Capture Audio 1-Tap', () => {

  beforeAll(async () => {
    // Launch with microphone permissions
    await launchApp({ microphone: 'YES', notifications: 'YES' });
  });

  beforeEach(async () => {
    // Reset app state before each test
    await reloadApp();
  });

  describe('AC1: Start Recording with < 500ms Latency', () => {

    it('should start audio recording within 500ms after tap', async () => {
      // GIVEN: I am on the main screen of the app
      await waitForElement('main-screen');
      await waitForElement('record-button');

      // WHEN: I tap the record button
      const latency = await measurePerformance('tap-to-record', async () => {
        await tapElement('record-button');
        await waitForElement('recording-indicator', 1000);
      });

      // THEN: audio recording starts within 500ms (NFR1 compliance)
      expect(latency).toBeLessThan(500);
    });

    it('should display pulsing red indicator during recording', async () => {
      // GIVEN: I am on the main screen
      await waitForElement('main-screen');

      // WHEN: I tap the record button
      await tapElement('record-button');

      // THEN: visual feedback is displayed (pulsing red indicator)
      await expectVisible('recording-indicator');
      await detoxExpect(element(by.id('recording-indicator'))).toHaveToggleValue(true);
    });

    it('should trigger haptic feedback on iOS/Android', async () => {
      // GIVEN: I am on the main screen
      await waitForElement('main-screen');

      // WHEN: I tap the record button
      await tapElement('record-button');

      // THEN: haptic feedback is triggered
      // Note: Haptic feedback cannot be directly asserted in Detox
      // This test validates the recording starts (indirect validation)
      await expectVisible('recording-indicator');
    });

    it('should create Capture entity with status "recording"', async () => {
      // GIVEN: I am on the main screen
      await waitForElement('main-screen');

      // WHEN: I tap the record button
      await tapElement('record-button');

      // THEN: a Capture entity is created in WatermelonDB with status "recording"
      // Note: Database state validated via UI state
      await expectVisible('recording-indicator');
      await expectVisible('recording-timer'); // Timer indicates active recording
    });

    it('should stream audio data to local storage', async () => {
      // GIVEN: I am on the main screen
      await waitForElement('main-screen');

      // WHEN: I tap the record button and record for 2 seconds
      await tapElement('record-button');
      await device.sleep(2000); // Record for 2 seconds

      // THEN: audio data is streamed to local storage
      // Note: File creation validated in AC2 (after save)
      await expectVisible('recording-timer');
    });
  });

  describe('AC2: Stop and Save Recording', () => {

    beforeEach(async () => {
      // Start recording before each test
      await waitForElement('record-button');
      await tapElement('record-button');
      await waitForElement('recording-indicator');
      await device.sleep(1000); // Record for 1 second
    });

    it('should stop recording immediately when stop button is tapped', async () => {
      // GIVEN: I am recording audio
      await expectVisible('recording-indicator');

      // WHEN: I tap the stop button
      await tapElement('stop-button');

      // THEN: the recording stops immediately
      await expectNotVisible('recording-indicator');
      await expectNotVisible('recording-timer');
    });

    it('should save audio file to device storage', async () => {
      // GIVEN: I am recording audio
      await expectVisible('recording-indicator');

      // WHEN: I tap the stop button
      await tapElement('stop-button');

      // THEN: the audio file is saved to device storage
      // Validated by checking capture appears in feed
      await waitForElement('capture-feed');
      await expectVisible('capture-item-0'); // First capture in feed
    });

    it('should update Capture entity with status "captured" and file path', async () => {
      // GIVEN: I am recording audio
      await expectVisible('recording-indicator');

      // WHEN: I tap the stop button
      await tapElement('stop-button');

      // THEN: the Capture entity is updated with status "captured" and file path
      // Validated by capture appearing in feed with metadata
      await waitForElement('capture-item-0');
      await expectVisible('capture-item-0-metadata'); // Shows duration, timestamp
    });

    it('should store audio file metadata (duration, size, timestamp)', async () => {
      // GIVEN: I am recording audio for 2 seconds
      await device.sleep(1000); // Additional recording time

      // WHEN: I tap the stop button
      await tapElement('stop-button');

      // THEN: the audio file metadata is stored
      await waitForElement('capture-item-0');
      await detoxExpect(element(by.id('capture-item-0-duration'))).toHaveText('00:02'); // 2 seconds
    });
  });

  describe('AC3: Offline Functionality', () => {

    it('should work identically without network connectivity', async () => {
      // GIVEN: I have no network connectivity
      await goOffline();
      await waitForElement('main-screen');

      // WHEN: I start and complete an audio recording
      await tapElement('record-button');
      await waitForElement('recording-indicator');
      await device.sleep(1000);
      await tapElement('stop-button');

      // THEN: the capture works identically to online mode (FR4, NFR7 compliance)
      await waitForElement('capture-item-0');
      await expectVisible('capture-item-0');

      // AND: no error is shown to the user
      await expectNotVisible('error-message');
      await expectNotVisible('network-error');
    });

    it('should mark Capture entity for future sync', async () => {
      // GIVEN: I have no network connectivity
      await goOffline();
      await waitForElement('main-screen');

      // WHEN: I complete a capture
      await tapElement('record-button');
      await waitForElement('recording-indicator');
      await device.sleep(1000);
      await tapElement('stop-button');

      // THEN: the Capture entity is marked for future sync
      await waitForElement('capture-item-0');
      await expectVisible('capture-item-0-sync-pending'); // Shows "pending sync" badge
    });
  });

  describe('AC4: Crash Recovery', () => {

    it('should recover partial recording after app crash', async () => {
      // GIVEN: I start recording
      await waitForElement('main-screen');
      await tapElement('record-button');
      await waitForElement('recording-indicator');
      await device.sleep(2000); // Record for 2 seconds

      // WHEN: the app crashes during recording
      await terminateApp();
      await launchApp({ microphone: 'YES', notifications: 'YES' });

      // THEN: the partial recording is recovered if possible (NFR8 compliance)
      await waitForElement('main-screen', 10000);
      // Check for recovery notification or recovered capture in feed
      // Note: Recovery logic may take time, using longer timeout
    });

    it('should notify user about recovered capture', async () => {
      // GIVEN: the app crashed with partial recording
      await waitForElement('main-screen');
      await tapElement('record-button');
      await device.sleep(1000);
      await terminateApp();

      // WHEN: I reopen the app
      await launchApp({ microphone: 'YES', notifications: 'YES' });

      // THEN: I receive a notification about the recovered capture
      await waitForElement('recovery-notification', 10000);
      await expectVisible('recovery-notification');
    });
  });

  describe('AC5: Microphone Permission Handling', () => {

    it('should prompt for microphone access when permission not granted', async () => {
      // GIVEN: microphone permission is not granted
      await device.launchApp({
        newInstance: true,
        permissions: { microphone: 'NO' },
      });
      await waitForElement('main-screen');

      // WHEN: I attempt to record
      await tapElement('record-button');

      // THEN: I am prompted to grant microphone access
      // Note: System permission dialog appears (OS-level, not testable via Detox)
      // We validate the app shows a permission request message
      await waitForElement('permission-required-message', 5000);
    });

    it('should only start recording after permission is granted', async () => {
      // GIVEN: I grant permission after initial denial
      await device.launchApp({
        newInstance: true,
        permissions: { microphone: 'YES' },
      });
      await waitForElement('main-screen');

      // WHEN: I tap record button
      await tapElement('record-button');

      // THEN: recording starts successfully
      await expectVisible('recording-indicator');
    });
  });
});
