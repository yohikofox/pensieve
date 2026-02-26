/**
 * User Features Service - Application Service
 * Story 7.1: Support Mode avec Permissions Backend
 *
 * Orchestrates fetching and caching of user feature flags
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { IUserFeaturesRepository } from '../domain/user-features-repository.interface';
import type { UserFeatures } from '../domain/user-features.model';
import {
  success,
  databaseError,
  type RepositoryResult,
  RepositoryResultType,
} from '@/contexts/shared/domain/Result';
import { TOKENS } from '@/infrastructure/di/tokens';

@injectable()
export class UserFeaturesService {
  constructor(
    @inject(TOKENS.IUserFeaturesRepository)
    private readonly repository: IUserFeaturesRepository,
  ) {}

  /**
   * Get user features with smart caching
   * Story 7.1 AC3: Fetch at startup, use cache if offline
   * Story 7.1 AC4: Cache valid until midnight
   *
   * @param userId - User ID to fetch features for
   * @param forceRefresh - Force fetch from server; still falls back to cache if server unreachable
   * @returns UserFeatures or default safe values
   */
  async getUserFeatures(
    userId: string,
    forceRefresh: boolean = false,
  ): Promise<RepositoryResult<UserFeatures>> {
    try {
      // Always try server first — cache is offline fallback only
      const fetchResult = await this.repository.fetchUserFeatures(userId);

      if (fetchResult.type === RepositoryResultType.SUCCESS && fetchResult.data) {
        // Update cache with fresh server data
        await this.repository.saveCachedFeatures(fetchResult.data);
        return success(fetchResult.data);
      }

      // Server unreachable — fall back to cache.
      // Even when forceRefresh=true, if the server is unreachable we prefer cached features
      // over returning empty features {} which would hide all gated UI elements (AC6).
      const cachedResult = await this.getCachedFeaturesIfValid();
      if (cachedResult.type === RepositoryResultType.SUCCESS && cachedResult.data) {
        const msg = forceRefresh
          ? 'Force refresh failed (server unreachable), falling back to valid cache'
          : 'Using cache due to server fetch failure';
        console.warn(msg, fetchResult.error);
        return success(cachedResult.data);
      }

      // Try expired cache as last resort
      const cache = await this.repository.getCachedFeatures();
      if (cache) {
        console.warn('Using expired cache as last resort due to fetch failure:', fetchResult.error);
        return success(cache.features);
      }

      // AC4: If offline and no cache, return safe defaults
      return success(this.getDefaultFeatures());
    } catch (error) {
      console.error('Error getting user features:', error);
      return databaseError(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Refresh user features from server
   * Story 7.1 AC5: Manual refresh from profile/settings
   */
  async refreshUserFeatures(
    userId: string,
  ): Promise<RepositoryResult<UserFeatures>> {
    return this.getUserFeatures(userId, true);
  }

  /**
   * Get cached features if valid (not expired)
   * Returns null if no cache or expired
   */
  private async getCachedFeaturesIfValid(): Promise<
    RepositoryResult<UserFeatures | null>
  > {
    try {
      const cache = await this.repository.getCachedFeatures();
      if (!cache) {
        return success(null);
      }

      const isValid = this.repository.isCacheValid(cache.cachedAt);
      if (!isValid) {
        // Clear expired cache
        await this.repository.clearExpiredCache();
        return success(null);
      }

      return success(cache.features);
    } catch (error) {
      return databaseError(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Get default safe feature values
   * AC6: If offline and no cache, return empty record — all getFeature() calls return false
   * This is intentional "security by default": no feature accessible offline without cache.
   */
  private getDefaultFeatures(): UserFeatures {
    return {};
  }
}
