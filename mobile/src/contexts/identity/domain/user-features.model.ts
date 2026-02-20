/**
 * User feature flags model
 * Story 7.1: Support Mode avec Permissions Backend
 *
 * Represents user permissions for various features.
 * Extensible for future feature flags.
 */
export interface UserFeatures {
  /**
   * Backend permission to access debug mode features
   * When false, debug mode toggle is hidden in settings
   */
  debug_mode_access: boolean;

  /**
   * Backend permission to access datamining (query builder) features
   * When false, the datamining section is hidden in settings
   */
  data_mining_access: boolean;

  // Future feature flags
  // error_reporting_enabled?: boolean;
  // transcription_retry_enabled?: boolean;
  // beta_features_access?: boolean;
}

/**
 * User features cache structure
 * Stored in AsyncStorage/MMKV with expiration at midnight
 */
export interface UserFeaturesCache {
  features: UserFeatures;
  cachedAt: number; // Unix timestamp
}
