/**
 * SettingsStore Debug Mode Tests
 * Story 7.1: Support Mode avec Permissions Backend
 *
 * Tests for debugModeAccess (backend permission) and debugMode (local toggle)
 */

import { useSettingsStore, isDebugModeEnabled } from '../settingsStore';

describe('SettingsStore - Debug Mode (Story 7.1)', () => {
  beforeEach(() => {
    // Reset store to initial state
    useSettingsStore.setState({
      debugModeAccess: false,
      debugMode: false,
    });
  });

  describe('setDebugModeAccess', () => {
    it('should set debugModeAccess to true', () => {
      const { setDebugModeAccess } = useSettingsStore.getState();

      setDebugModeAccess(true);

      const { debugModeAccess } = useSettingsStore.getState();
      expect(debugModeAccess).toBe(true);
    });

    it('should set debugModeAccess to false', () => {
      const { setDebugModeAccess } = useSettingsStore.getState();

      setDebugModeAccess(true);
      setDebugModeAccess(false);

      const { debugModeAccess } = useSettingsStore.getState();
      expect(debugModeAccess).toBe(false);
    });

    it('should disable debugMode when debugModeAccess is revoked (AC7)', () => {
      const { setDebugModeAccess, setDebugMode } = useSettingsStore.getState();

      // Enable both
      setDebugModeAccess(true);
      setDebugMode(true);

      expect(useSettingsStore.getState().debugMode).toBe(true);

      // Revoke backend permission
      setDebugModeAccess(false);

      // Debug mode should be automatically disabled
      const { debugMode } = useSettingsStore.getState();
      expect(debugMode).toBe(false);
    });
  });

  describe('setDebugMode', () => {
    it('should enable debugMode when debugModeAccess is granted (AC8)', () => {
      const { setDebugModeAccess, setDebugMode } = useSettingsStore.getState();

      setDebugModeAccess(true);
      setDebugMode(true);

      const { debugMode } = useSettingsStore.getState();
      expect(debugMode).toBe(true);
    });

    it('should block debugMode activation when debugModeAccess is denied (AC8)', () => {
      const { setDebugMode } = useSettingsStore.getState();

      // Try to enable debug mode without backend permission
      setDebugMode(true);

      const { debugMode } = useSettingsStore.getState();
      expect(debugMode).toBe(false);
    });

    it('should allow disabling debugMode even without permission', () => {
      const { setDebugModeAccess, setDebugMode } = useSettingsStore.getState();

      // Enable with permission
      setDebugModeAccess(true);
      setDebugMode(true);

      // Revoke permission
      setDebugModeAccess(false);

      // Should already be disabled by AC7
      expect(useSettingsStore.getState().debugMode).toBe(false);

      // Explicitly disable should still work
      setDebugMode(false);
      expect(useSettingsStore.getState().debugMode).toBe(false);
    });
  });

  describe('toggleDebugMode', () => {
    it('should toggle debugMode when debugModeAccess is granted', () => {
      const { setDebugModeAccess, toggleDebugMode } = useSettingsStore.getState();

      setDebugModeAccess(true);

      toggleDebugMode();
      expect(useSettingsStore.getState().debugMode).toBe(true);

      toggleDebugMode();
      expect(useSettingsStore.getState().debugMode).toBe(false);
    });

    it('should block toggle when debugModeAccess is denied (AC8)', () => {
      const { toggleDebugMode } = useSettingsStore.getState();

      // debugModeAccess is false by default
      toggleDebugMode();

      const { debugMode } = useSettingsStore.getState();
      expect(debugMode).toBe(false);
    });

    it('should allow toggling OFF even without permission', () => {
      const { setDebugModeAccess, setDebugMode, toggleDebugMode } =
        useSettingsStore.getState();

      // Enable with permission
      setDebugModeAccess(true);
      setDebugMode(true);

      // Revoke permission (auto-disables debug mode)
      setDebugModeAccess(false);

      // Debug mode should already be false
      expect(useSettingsStore.getState().debugMode).toBe(false);
    });
  });

  describe('isDebugModeEnabled - AC9', () => {
    it('should return true when both debugModeAccess and debugMode are true', () => {
      const { setDebugModeAccess, setDebugMode } = useSettingsStore.getState();

      setDebugModeAccess(true);
      setDebugMode(true);

      expect(isDebugModeEnabled()).toBe(true);
    });

    it('should return false when debugModeAccess is false', () => {
      const { setDebugMode } = useSettingsStore.getState();

      // debugModeAccess is false by default
      setDebugMode(true); // This will be blocked

      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should return false when debugMode is false', () => {
      const { setDebugModeAccess } = useSettingsStore.getState();

      setDebugModeAccess(true);
      // debugMode is false by default

      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should return false when both are false', () => {
      // Both are false by default
      expect(isDebugModeEnabled()).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full activation flow (AC11)', () => {
      const { setDebugModeAccess, setDebugMode } = useSettingsStore.getState();

      // Admin activates permission
      setDebugModeAccess(true);
      expect(useSettingsStore.getState().debugModeAccess).toBe(true);

      // User sees switch and activates it
      setDebugMode(true);
      expect(useSettingsStore.getState().debugMode).toBe(true);

      // Both are true, so debug mode is fully enabled
      expect(isDebugModeEnabled()).toBe(true);
    });

    it('should handle full deactivation flow (AC11)', () => {
      const { setDebugModeAccess, setDebugMode } = useSettingsStore.getState();

      // Start with debug mode enabled
      setDebugModeAccess(true);
      setDebugMode(true);
      expect(isDebugModeEnabled()).toBe(true);

      // Admin revokes permission
      setDebugModeAccess(false);

      // Debug mode should be automatically disabled
      expect(useSettingsStore.getState().debugMode).toBe(false);
      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should maintain local toggle preference when permission is re-granted', () => {
      const { setDebugModeAccess, setDebugMode } = useSettingsStore.getState();

      // User had debug mode enabled
      setDebugModeAccess(true);
      setDebugMode(true);

      // Permission revoked (auto-disables debug mode)
      setDebugModeAccess(false);
      expect(useSettingsStore.getState().debugMode).toBe(false);

      // Permission re-granted
      setDebugModeAccess(true);

      // Debug mode remains disabled (user must re-enable)
      expect(useSettingsStore.getState().debugMode).toBe(false);
      expect(isDebugModeEnabled()).toBe(false);

      // User can now re-enable
      setDebugMode(true);
      expect(isDebugModeEnabled()).toBe(true);
    });
  });
});
