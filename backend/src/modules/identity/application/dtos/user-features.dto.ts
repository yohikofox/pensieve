/**
 * DTO for user feature flags/permissions
 * Story 7.1: Support Mode avec Permissions Backend
 *
 * Extensible format for future feature flags:
 * - debug_mode_access: Backend permission for debug mode
 * - error_reporting_enabled: Future feature flag (Story 7.2?)
 * - transcription_retry_enabled: Future feature flag
 * - beta_features_access: Future feature flag
 */
export class UserFeaturesDto {
  /**
   * Backend permission to access debug mode features
   * Controls whether the debug mode toggle appears in mobile settings
   */
  debug_mode_access!: boolean;

  /**
   * Backend permission to access datamining (query builder) features
   * Controls whether the datamining section appears in mobile settings
   */
  data_mining_access!: boolean;

  // Future feature flags can be added here without breaking changes
  // error_reporting_enabled?: boolean;
  // transcription_retry_enabled?: boolean;
  // beta_features_access?: boolean;
}
