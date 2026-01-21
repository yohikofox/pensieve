/**
 * E2E Tests: Story 2.2 - Capture Texte Rapide
 *
 * Tests failing in RED phase - waiting for implementation
 * Run: detox test --configuration ios.sim.debug
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('Story 2.2: Capture Texte Rapide', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('AC1: Open Text Input Field Immediately', () => {
    it('should display text input field when text capture button tapped', async () => {
      // GIVEN: I am on the main screen
      await waitFor(element(by.id('main-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // WHEN: I tap the text capture button
      await element(by.id('text-capture-button')).tap();

      // THEN: Text input field appears immediately
      await waitFor(element(by.id('text-input-field')))
        .toBeVisible()
        .withTimeout(300); // Should be nearly instant
    });

    it('should open keyboard automatically', async () => {
      // GIVEN: I am on the main screen
      await waitFor(element(by.id('main-screen'))).toBeVisible();

      // WHEN: I tap the text capture button
      await element(by.id('text-capture-button')).tap();

      // THEN: Keyboard opens automatically
      // Note: Keyboard state is difficult to test directly in Detox
      // Verify text input has focus instead
      await waitFor(element(by.id('text-input-field')))
        .toBeVisible()
        .withTimeout(300);

      // Verify cursor focus by attempting to type
      await element(by.id('text-input-field')).typeText('Test');
      await detoxExpect(element(by.id('text-input-field'))).toHaveText('Test');
    });

    it('should focus cursor in text field', async () => {
      // GIVEN: I tap the text capture button
      await element(by.id('text-capture-button')).tap();

      // WHEN: Text input appears
      await waitFor(element(by.id('text-input-field'))).toBeVisible();

      // THEN: Cursor is focused (verified by typing)
      await element(by.id('text-input-field')).typeText('Cursor focused');
      await detoxExpect(element(by.id('text-input-field'))).toHaveText('Cursor focused');
    });
  });

  describe('AC2: Save Text Capture with Metadata', () => {
    it('should save text capture successfully', async () => {
      // GIVEN: I have typed text in the capture field
      await element(by.id('text-capture-button')).tap();
      await waitFor(element(by.id('text-input-field'))).toBeVisible();
      await element(by.id('text-input-field')).typeText('My brilliant idea');

      // WHEN: I tap the save button
      await element(by.id('save-text-button')).tap();

      // THEN: Success indicator is shown
      await waitFor(element(by.id('text-saved-indicator')))
        .toBeVisible()
        .withTimeout(1000);
    });

    it('should clear text input after successful save', async () => {
      // GIVEN: I save a text capture
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText('First thought');
      await element(by.id('save-text-button')).tap();
      await waitFor(element(by.id('text-saved-indicator'))).toBeVisible();

      // WHEN: The save completes
      await new Promise(resolve => setTimeout(resolve, 500));

      // THEN: Text input field is cleared for next capture
      await detoxExpect(element(by.id('text-input-field'))).toHaveText('');
    });

    it('should display saved capture in feed', async () => {
      // GIVEN: I save a text capture
      const captureText = 'Test capture in feed';
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText(captureText);
      await element(by.id('save-text-button')).tap();
      await waitFor(element(by.id('text-saved-indicator'))).toBeVisible();

      // WHEN: I view the capture feed
      await element(by.id('close-text-capture')).tap(); // Close text input modal
      await waitFor(element(by.id('capture-feed'))).toBeVisible();

      // THEN: Saved capture appears in feed
      await waitFor(element(by.text(captureText)))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  describe('AC3: Cancel Unsaved Text with Confirmation', () => {
    it('should prompt for confirmation when discarding unsaved text', async () => {
      // GIVEN: I start typing a text capture
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText('Unsaved content');

      // WHEN: I cancel/navigate away before saving
      await element(by.id('cancel-text-button')).tap();

      // THEN: I am prompted to confirm discarding
      await waitFor(element(by.text('Discard unsaved text?')))
        .toBeVisible()
        .withTimeout(1000);
    });

    it('should discard text when user confirms', async () => {
      // GIVEN: I have unsaved text and confirmation dialog shown
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText('Will be discarded');
      await element(by.id('cancel-text-button')).tap();
      await waitFor(element(by.text('Discard unsaved text?'))).toBeVisible();

      // WHEN: I confirm discard
      await element(by.text('Discard')).tap();

      // THEN: Capture is not saved (text input closes)
      await waitFor(element(by.id('text-input-field')))
        .not.toBeVisible()
        .withTimeout(1000);
    });

    it('should keep editing when user cancels discard', async () => {
      // GIVEN: I have unsaved text and confirmation dialog shown
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText('Keep this text');
      await element(by.id('cancel-text-button')).tap();
      await waitFor(element(by.text('Discard unsaved text?'))).toBeVisible();

      // WHEN: I choose "Keep Editing"
      await element(by.text('Keep Editing')).tap();

      // THEN: Text input remains visible with content intact
      await detoxExpect(element(by.id('text-input-field'))).toBeVisible();
      await detoxExpect(element(by.id('text-input-field'))).toHaveText('Keep this text');
    });

    it('should not prompt when canceling empty text field', async () => {
      // GIVEN: Text input is empty
      await element(by.id('text-capture-button')).tap();
      await waitFor(element(by.id('text-input-field'))).toBeVisible();
      // No text typed

      // WHEN: I cancel
      await element(by.id('cancel-text-button')).tap();

      // THEN: No confirmation dialog (closes immediately)
      await waitFor(element(by.id('text-input-field')))
        .not.toBeVisible()
        .withTimeout(500);
    });
  });

  describe('AC4: Offline Text Capture Functionality', () => {
    it('should save text capture offline without errors', async () => {
      // GIVEN: I have no network connectivity
      // Note: Network mocking requires app-level implementation

      // WHEN: I create and save a text capture
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText('Offline text capture');
      await element(by.id('save-text-button')).tap();

      // THEN: Capture is saved locally
      await waitFor(element(by.id('text-saved-indicator'))).toBeVisible();

      // AND: No error is shown
      await detoxExpect(element(by.id('error-message'))).not.toExist();
    });

    it('should mark capture for sync when offline', async () => {
      // GIVEN: I am offline
      // WHEN: I save a text capture
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText('Pending sync');
      await element(by.id('save-text-button')).tap();
      await waitFor(element(by.id('text-saved-indicator'))).toBeVisible();

      // THEN: Capture is marked for sync
      await element(by.id('close-text-capture')).tap();
      await waitFor(element(by.id('sync-pending-indicator')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  describe('AC5: Empty Text Validation', () => {
    it('should show validation error for empty text', async () => {
      // GIVEN: I have empty text field
      await element(by.id('text-capture-button')).tap();
      await waitFor(element(by.id('text-input-field'))).toBeVisible();
      // Text field is empty

      // WHEN: I attempt to save
      await element(by.id('save-text-button')).tap();

      // THEN: I receive validation message
      await waitFor(element(by.text('Please enter some text')))
        .toBeVisible()
        .withTimeout(1000);
    });

    it('should disable save button when text is empty', async () => {
      // GIVEN: I open text capture
      await element(by.id('text-capture-button')).tap();
      await waitFor(element(by.id('text-input-field'))).toBeVisible();

      // WHEN: Text field is empty
      // THEN: Save button is disabled
      await detoxExpect(element(by.id('save-text-button'))).toHaveToggleValue(false);
    });

    it('should enable save button when text is entered', async () => {
      // GIVEN: I open text capture (save button disabled)
      await element(by.id('text-capture-button')).tap();
      await waitFor(element(by.id('text-input-field'))).toBeVisible();

      // WHEN: I type text
      await element(by.id('text-input-field')).typeText('Some text');

      // THEN: Save button is enabled
      await detoxExpect(element(by.id('save-text-button'))).toHaveToggleValue(true);
    });

    it('should not create empty Capture entity', async () => {
      // GIVEN: I attempt to save empty text
      await element(by.id('text-capture-button')).tap();
      await element(by.id('save-text-button')).tap();
      await waitFor(element(by.text('Please enter some text'))).toBeVisible();

      // WHEN: I close the validation error
      // THEN: No capture is added to feed
      await element(by.id('cancel-text-button')).tap();
      await waitFor(element(by.id('capture-feed'))).toBeVisible();

      // Verify feed is empty or unchanged
      // (Requires checking count or specific empty state indicator)
    });
  });

  describe('AC6: Haptic Feedback on Save', () => {
    it('should trigger haptic feedback when save succeeds', async () => {
      // GIVEN: I save a text capture
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText('Haptic test');

      // WHEN: Save is successful
      await element(by.id('save-text-button')).tap();

      // THEN: Haptic feedback is triggered
      // Note: Haptic feedback cannot be tested directly via Detox
      // Verify save animation as indirect confirmation
      await waitFor(element(by.id('text-saved-indicator'))).toBeVisible();
      await waitFor(element(by.id('save-animation')))
        .toBeVisible()
        .withTimeout(500);
    });

    it('should show save animation', async () => {
      // GIVEN: I save a text capture
      await element(by.id('text-capture-button')).tap();
      await element(by.id('text-input-field')).typeText('Animation test');

      // WHEN: Save completes
      await element(by.id('save-text-button')).tap();

      // THEN: Animation shows capture being added to feed
      await waitFor(element(by.id('save-animation')))
        .toBeVisible()
        .withTimeout(500);

      // Animation should fade out
      await waitFor(element(by.id('save-animation')))
        .not.toBeVisible()
        .withTimeout(2000);
    });
  });
});
