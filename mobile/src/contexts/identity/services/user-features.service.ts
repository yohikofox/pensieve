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
   * AC3: Fetch at startup, use cache if offline
   * AC4: Cache valid until midnight
   *
   * @param userId - User ID to fetch features for
   * @param forceRefresh - Force fetch from server even if cache is valid
   * @returns UserFeatures or default safe values
   */
  async getUserFeatures(
    userId: string,
    forceRefresh: boolean = false,
  ): Promise<RepositoryResult<UserFeatures>> {
    try {
      // Try to get cached features first
      if (!forceRefresh) {
        const cachedResult = await this.getCachedFeaturesIfValid();
        if (cachedResult.type === RepositoryResultType.SUCCESS && cachedResult.data) {
          return success(cachedResult.data);
        }
      }

      // Fetch from server
      const fetchResult = await this.repository.fetchUserFeatures(userId);

      if (fetchResult.type === RepositoryResultType.SUCCESS && fetchResult.data) {
        // Save to cache on successful fetch
        await this.repository.saveCachedFeatures(fetchResult.data);
        return success(fetchResult.data);
      }

      // If fetch failed, try to use cached features (even if expired)
      const cache = await this.repository.getCachedFeatures();
      if (cache) {
        console.warn(
          'Using expired cache due to fetch failure:',
          fetchResult.error,
        );
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
   * AC5: Manual refresh from profile/settings
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
   * AC4: Default to false for security
   */
  private getDefaultFeatures(): UserFeatures {
    return {
      debug_mode_access: false,
    };
  }
}
