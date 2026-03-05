/**
 * Feature Flag Keys — Constants
 * Story 24.3: Feature Flag System — Adaptation Mobile & UI Gating
 *
 * Centralized constants for all feature flag keys.
 * Use these when reading from settingsStore.getFeature(key).
 *
 * Keys must match the string values returned by the backend
 * (POST /api/users/:userId/features → Record<string, boolean>).
 */
export const FEATURE_KEYS = {
  DEBUG_MODE: 'debug_mode',
  DATA_MINING: 'data_mining',
  NEWS_TAB: 'news_tab',
  PROJECTS_TAB: 'projects_tab',
  CAPTURE_MEDIA_BUTTONS: 'capture_media_buttons',
  LIVE_TRANSCRIPTION: 'live_transcription',
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];
