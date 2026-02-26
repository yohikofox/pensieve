/**
 * SettingsStore Debug Mode Tests
 * Story 24.3: Feature Flag System — Adaptation Mobile & UI Gating
 *
 * Tests for debug mode with new feature flag system.
 * Migrated from Story 7.1: setDebugModeAccess(true) → setFeatures({ debug_mode: true })
 * Migrated from Story 7.1: state.debugModeAccess → state.getFeature('debug_mode')
 */

import { useSettingsStore, isDebugModeEnabled } from '../settingsStore';
import { FEATURE_KEYS } from '../../contexts/identity/domain/feature-keys';

describe('SettingsStore - Debug Mode (Story 24.3)', () => {
  beforeEach(() => {
    // Reset store to initial state
    useSettingsStore.setState({
      features: {},
      debugMode: false,
    });
  });

  describe('setFeatures + debug_mode (replaces setDebugModeAccess)', () => {
    it('should grant debug mode access via setFeatures({ debug_mode: true })', () => {
      const { setFeatures, getFeature } = useSettingsStore.getState();

      setFeatures({ [FEATURE_KEYS.DEBUG_MODE]: true });

      expect(getFeature(FEATURE_KEYS.DEBUG_MODE)).toBe(true);
    });

    it('should revoke debug mode access via setFeatures({ debug_mode: false })', () => {
      const { setFeatures, getFeature } = useSettingsStore.getState();

      setFeatures({ [FEATURE_KEYS.DEBUG_MODE]: true });
      setFeatures({ [FEATURE_KEYS.DEBUG_MODE]: false });

      expect(getFeature(FEATURE_KEYS.DEBUG_MODE)).toBe(false);
    });

    it('should disable debugMode when debug_mode feature is absent after setFeatures', () => {
      // Setup: debug mode was active
      useSettingsStore.setState({
        features: { [FEATURE_KEYS.DEBUG_MODE]: true },
        debugMode: true,
      });

      // Remove the debug_mode feature
      const { setFeatures } = useSettingsStore.getState();
      setFeatures({});

      // isDebugModeEnabled reads features dynamically, so it's now false
      expect(isDebugModeEnabled()).toBe(false);
    });
  });

  describe('setDebugMode', () => {
    it('should enable debugMode when debug_mode feature is granted', () => {
      useSettingsStore.setState({ features: { [FEATURE_KEYS.DEBUG_MODE]: true } });
      const { setDebugMode } = useSettingsStore.getState();

      setDebugMode(true);

      const { debugMode } = useSettingsStore.getState();
      expect(debugMode).toBe(true);
    });

    it('should block debugMode activation when debug_mode feature is denied', () => {
      useSettingsStore.setState({ features: {} });
      const { setDebugMode } = useSettingsStore.getState();

      setDebugMode(true);

      const { debugMode } = useSettingsStore.getState();
      expect(debugMode).toBe(false);
    });

    it('should allow disabling debugMode even without feature', () => {
      // Enable with feature
      useSettingsStore.setState({
        features: { [FEATURE_KEYS.DEBUG_MODE]: true },
        debugMode: true,
      });

      // Remove feature (access revoked)
      const { setFeatures } = useSettingsStore.getState();
      setFeatures({});

      // Debug mode is now blocked by double-gate
      expect(isDebugModeEnabled()).toBe(false);

      // Explicitly disabling should still work
      const { setDebugMode } = useSettingsStore.getState();
      setDebugMode(false);
      expect(useSettingsStore.getState().debugMode).toBe(false);
    });
  });

  describe('toggleDebugMode', () => {
    it('should toggle debugMode when debug_mode feature is granted', () => {
      useSettingsStore.setState({ features: { [FEATURE_KEYS.DEBUG_MODE]: true } });
      const { toggleDebugMode } = useSettingsStore.getState();

      toggleDebugMode();
      expect(useSettingsStore.getState().debugMode).toBe(true);

      toggleDebugMode();
      expect(useSettingsStore.getState().debugMode).toBe(false);
    });

    it('should block toggle when debug_mode feature is absent', () => {
      useSettingsStore.setState({ features: {} });
      const { toggleDebugMode } = useSettingsStore.getState();

      toggleDebugMode();

      const { debugMode } = useSettingsStore.getState();
      expect(debugMode).toBe(false);
    });

    it('should allow toggling OFF even without feature', () => {
      // Enable debug mode with feature
      useSettingsStore.setState({
        features: { [FEATURE_KEYS.DEBUG_MODE]: true },
        debugMode: true,
      });

      // Revoke feature access
      const { setFeatures } = useSettingsStore.getState();
      setFeatures({});

      // Even without feature, user must be able to toggle OFF (always allowed to disable)
      const { toggleDebugMode } = useSettingsStore.getState();
      toggleDebugMode(); // debugMode: true → false (toggle OFF is never blocked)

      expect(useSettingsStore.getState().debugMode).toBe(false);
      expect(isDebugModeEnabled()).toBe(false); // double-gate: feature absent + toggle off
    });
  });

  describe('isDebugModeEnabled — double gate', () => {
    it('should return true when both debug_mode feature and debugMode toggle are true', () => {
      useSettingsStore.setState({
        features: { [FEATURE_KEYS.DEBUG_MODE]: true },
        debugMode: true,
      });

      expect(isDebugModeEnabled()).toBe(true);
    });

    it('should return false when debug_mode feature is false', () => {
      useSettingsStore.setState({
        features: { [FEATURE_KEYS.DEBUG_MODE]: false },
        debugMode: true,
      });

      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should return false when debugMode toggle is false', () => {
      useSettingsStore.setState({
        features: { [FEATURE_KEYS.DEBUG_MODE]: true },
        debugMode: false,
      });

      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should return false when both are false/absent', () => {
      // Both are false by default
      expect(isDebugModeEnabled()).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full activation flow', () => {
      const { setFeatures, setDebugMode } = useSettingsStore.getState();

      // Admin activates feature
      setFeatures({ [FEATURE_KEYS.DEBUG_MODE]: true });
      expect(useSettingsStore.getState().getFeature(FEATURE_KEYS.DEBUG_MODE)).toBe(true);

      // User sees switch and activates it
      setDebugMode(true);
      expect(useSettingsStore.getState().debugMode).toBe(true);

      // Both are true, so debug mode is fully enabled
      expect(isDebugModeEnabled()).toBe(true);
    });

    it('should handle full deactivation flow', () => {
      const { setFeatures, setDebugMode } = useSettingsStore.getState();

      // Start with debug mode enabled
      setFeatures({ [FEATURE_KEYS.DEBUG_MODE]: true });
      setDebugMode(true);
      expect(isDebugModeEnabled()).toBe(true);

      // Admin revokes feature
      setFeatures({});

      // Debug mode should be effectively disabled via double-gate
      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should maintain local toggle preference when feature is re-granted', () => {
      const { setFeatures, setDebugMode } = useSettingsStore.getState();

      // User had debug mode enabled
      setFeatures({ [FEATURE_KEYS.DEBUG_MODE]: true });
      setDebugMode(true);

      // Feature revoked
      setFeatures({});
      expect(isDebugModeEnabled()).toBe(false);

      // Feature re-granted
      setFeatures({ [FEATURE_KEYS.DEBUG_MODE]: true });

      // Debug mode toggle is still true in state — isDebugModeEnabled returns true
      // (double gate: feature true + debugMode true)
      expect(isDebugModeEnabled()).toBe(true);
    });
  });
});
