/**
 * SettingsStore Feature Flags Tests
 * Story 24.3: Feature Flag System — Adaptation Mobile & UI Gating
 *
 * Tests for features: Record<string, boolean> + getFeature() + setFeatures()
 * Replaces debugModeAccess / dataMiningEnabled individual booleans.
 */

import { useSettingsStore, isDebugModeEnabled } from '../settingsStore';

describe('SettingsStore - Feature Flags (Story 24.3)', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      features: {},
      debugMode: false,
    });
  });

  // ─── setFeatures ────────────────────────────────────────────────────────────

  describe('setFeatures', () => {
    it('should store the full Record<string, boolean>', () => {
      const { setFeatures } = useSettingsStore.getState();

      setFeatures({ debug_mode: true, news_tab: false, data_mining: true });

      const { features } = useSettingsStore.getState();
      expect(features['debug_mode']).toBe(true);
      expect(features['news_tab']).toBe(false);
      expect(features['data_mining']).toBe(true);
    });

    it('should replace existing features entirely', () => {
      const { setFeatures } = useSettingsStore.getState();

      setFeatures({ debug_mode: true, news_tab: true });
      setFeatures({ news_tab: false }); // No debug_mode

      const { features } = useSettingsStore.getState();
      expect(features['debug_mode']).toBeUndefined();
      expect(features['news_tab']).toBe(false);
    });

    it('should accept empty object (offline safe default)', () => {
      const { setFeatures } = useSettingsStore.getState();

      setFeatures({});

      const { features } = useSettingsStore.getState();
      expect(features).toEqual({});
    });
  });

  // ─── getFeature ────────────────────────────────────────────────────────────

  describe('getFeature', () => {
    it('should return true when key is present and true', () => {
      useSettingsStore.setState({ features: { news_tab: true } });
      const { getFeature } = useSettingsStore.getState();

      expect(getFeature('news_tab')).toBe(true);
    });

    it('should return false when key is present and false', () => {
      useSettingsStore.setState({ features: { news_tab: false } });
      const { getFeature } = useSettingsStore.getState();

      expect(getFeature('news_tab')).toBe(false);
    });

    it('should return false when key is absent (AC6: offline safe default)', () => {
      useSettingsStore.setState({ features: {} });
      const { getFeature } = useSettingsStore.getState();

      expect(getFeature('unknown_key')).toBe(false);
    });

    it('should return false when features is empty (offline fallback)', () => {
      useSettingsStore.setState({ features: {} });
      const { getFeature } = useSettingsStore.getState();

      expect(getFeature('news_tab')).toBe(false);
      expect(getFeature('projects_tab')).toBe(false);
      expect(getFeature('capture_media_buttons')).toBe(false);
      expect(getFeature('debug_mode')).toBe(false);
      expect(getFeature('data_mining')).toBe(false);
    });
  });

  // ─── isDebugModeEnabled — Double gate ─────────────────────────────────────

  describe('isDebugModeEnabled — double gate (AC2)', () => {
    it('should return true when debug_mode feature is true AND debugMode toggle is true', () => {
      useSettingsStore.setState({
        features: { debug_mode: true },
        debugMode: true,
      });

      expect(isDebugModeEnabled()).toBe(true);
    });

    it('should return false when debug_mode feature is false (no backend access)', () => {
      useSettingsStore.setState({
        features: { debug_mode: false },
        debugMode: true,
      });

      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should return false when debugMode toggle is false (user did not enable)', () => {
      useSettingsStore.setState({
        features: { debug_mode: true },
        debugMode: false,
      });

      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should return false when both are false', () => {
      useSettingsStore.setState({ features: {}, debugMode: false });

      expect(isDebugModeEnabled()).toBe(false);
    });

    it('should return false when feature key absent (offline)', () => {
      useSettingsStore.setState({ features: {}, debugMode: true });

      expect(isDebugModeEnabled()).toBe(false);
    });
  });

  // ─── setDebugMode — respects debug_mode feature gate ──────────────────────

  describe('setDebugMode with feature gate', () => {
    it('should enable debugMode when debug_mode feature is true', () => {
      useSettingsStore.setState({ features: { debug_mode: true }, debugMode: false });
      const { setDebugMode } = useSettingsStore.getState();

      setDebugMode(true);

      expect(useSettingsStore.getState().debugMode).toBe(true);
    });

    it('should block debugMode when debug_mode feature is false (AC2)', () => {
      useSettingsStore.setState({ features: { debug_mode: false }, debugMode: false });
      const { setDebugMode } = useSettingsStore.getState();

      setDebugMode(true);

      expect(useSettingsStore.getState().debugMode).toBe(false);
    });

    it('should block debugMode when debug_mode feature is absent (offline)', () => {
      useSettingsStore.setState({ features: {}, debugMode: false });
      const { setDebugMode } = useSettingsStore.getState();

      setDebugMode(true);

      expect(useSettingsStore.getState().debugMode).toBe(false);
    });
  });

  // ─── toggleDebugMode — respects debug_mode feature gate ───────────────────

  describe('toggleDebugMode with feature gate', () => {
    it('should toggle ON when debug_mode feature is true', () => {
      useSettingsStore.setState({ features: { debug_mode: true }, debugMode: false });
      const { toggleDebugMode } = useSettingsStore.getState();

      toggleDebugMode();

      expect(useSettingsStore.getState().debugMode).toBe(true);
    });

    it('should block toggle when debug_mode feature is absent', () => {
      useSettingsStore.setState({ features: {}, debugMode: false });
      const { toggleDebugMode } = useSettingsStore.getState();

      toggleDebugMode();

      expect(useSettingsStore.getState().debugMode).toBe(false);
    });
  });

  // ─── revoking access — debug mode disabled when feature removed ───────────

  describe('revocation via setFeatures', () => {
    it('should disable debugMode when debug_mode feature is removed via setFeatures', () => {
      // Setup: debug mode was active
      useSettingsStore.setState({
        features: { debug_mode: true },
        debugMode: true,
      });

      expect(isDebugModeEnabled()).toBe(true);

      // Revoke feature via setFeatures (no debug_mode key)
      const { setFeatures } = useSettingsStore.getState();
      setFeatures({});

      // isDebugModeEnabled now depends on getFeature which returns false
      expect(isDebugModeEnabled()).toBe(false);
    });
  });
});
