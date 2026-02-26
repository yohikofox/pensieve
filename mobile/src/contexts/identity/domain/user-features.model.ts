/**
 * User feature flags model
 * Story 24.3: Feature Flag System — Adaptation Mobile & UI Gating
 *
 * UserFeatures is now a dynamic Record<string, boolean>.
 * Feature keys are defined as constants in feature-keys.ts.
 *
 * Previous static fields (debug_mode_access, data_mining_access) have been
 * migrated to the generic record format by the backend (Story 24.1).
 */
export type UserFeatures = Record<string, boolean>;

/**
 * User features cache structure
 * Stored in AsyncStorage with expiration at midnight (ADR-022 compliant).
 * The cache holds the full Record, not individual fields.
 */
export interface UserFeaturesCache {
  features: UserFeatures;
  cachedAt: number; // Unix timestamp
}
