import type { UserFeatures, UserFeaturesCache } from './user-features.model';
import type { RepositoryResult } from '@/contexts/shared/domain/Result';

/**
 * Repository interface for user features
 * Story 7.1: Support Mode avec Permissions Backend
 *
 * Defines contract for fetching and caching user feature flags
 */
export interface IUserFeaturesRepository {
  /**
   * Fetch user features from backend
   * @param userId - User ID
   * @returns UserFeatures or error
   */
  fetchUserFeatures(userId: string): Promise<RepositoryResult<UserFeatures>>;

  /**
   * Get cached features from local storage
   * @returns UserFeaturesCache or null if not cached
   */
  getCachedFeatures(): Promise<UserFeaturesCache | null>;

  /**
   * Save features to local cache
   * @param features - Features to cache
   * @param cachedAt - Timestamp of cache (defaults to now)
   */
  saveCachedFeatures(
    features: UserFeatures,
    cachedAt?: number,
  ): Promise<RepositoryResult<void>>;

  /**
   * Check if cached features are still valid (not expired)
   * Expires at midnight (00:00) of the day after caching
   * @param cachedAt - Timestamp when features were cached
   * @returns True if cache is still valid
   */
  isCacheValid(cachedAt: number): boolean;

  /**
   * Clear expired cache
   */
  clearExpiredCache(): Promise<RepositoryResult<void>>;
}
