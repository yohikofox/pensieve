/**
 * User Features Repository - Data Access Layer
 * Story 7.1: Support Mode avec Permissions Backend
 *
 * Handles fetching user features from backend and caching locally with midnight expiration.
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
// ASYNC_STORAGE_OK: UI preference cache only (user feature flags, TTL-based, non-authoritative) — not critical data (ADR-022)
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IUserFeaturesRepository } from '../domain/user-features-repository.interface';
import type { UserFeatures, UserFeaturesCache } from '../domain/user-features.model';
import {
  success,
  databaseError,
  type RepositoryResult,
  RepositoryResultType,
} from '@/contexts/shared/domain/Result';
import { apiConfig } from '@/config/api';
import { AuthTokenManager } from '@/infrastructure/auth/AuthTokenManager';
import { TOKENS } from '@/infrastructure/di/tokens';

const CACHE_KEY = '@pensieve:userFeatures';

@injectable()
export class UserFeaturesRepository implements IUserFeaturesRepository {

  constructor(
    @inject(TOKENS.IAuthTokenManager) private readonly tokenManager: AuthTokenManager,
  ) {}

  /**
   * Fetch user features from backend API
   * AC3: Fetch at app startup
   */
  async fetchUserFeatures(userId: string): Promise<RepositoryResult<UserFeatures>> {
    try {
      const token = await this.getAuthToken();

      const response = await fetch(apiConfig.endpoints.users.features(userId), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return databaseError(
          `Failed to fetch user features: ${response.status} ${errorText}`,
        );
      }

      const data = (await response.json()) as UserFeatures;
      return success(data);
    } catch (error) {
      return databaseError(
        error instanceof Error
          ? error.message
          : 'Unknown error fetching user features',
      );
    }
  }

  /**
   * Get cached features from AsyncStorage
   * AC4: Use cache when offline
   */
  async getCachedFeatures(): Promise<UserFeaturesCache | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) {
        return null;
      }

      const cache = JSON.parse(cached) as UserFeaturesCache;
      return cache;
    } catch (error) {
      console.error('Failed to get cached features:', error);
      return null;
    }
  }

  /**
   * Save features to AsyncStorage with timestamp
   * AC4: Persist cache with expiration
   */
  async saveCachedFeatures(
    features: UserFeatures,
    cachedAt: number = Date.now(),
  ): Promise<RepositoryResult<void>> {
    try {
      const cache: UserFeaturesCache = {
        features,
        cachedAt,
      };

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return success(undefined);
    } catch (error) {
      return databaseError(
        error instanceof Error
          ? error.message
          : 'Failed to save cached features',
      );
    }
  }

  /**
   * Check if cache is still valid (before midnight)
   * AC4: Cache expires at midnight
   */
  isCacheValid(cachedAt: number): boolean {
    const now = new Date();
    const cacheDate = new Date(cachedAt);

    // Cache is valid if it's from the same calendar day
    return (
      now.getFullYear() === cacheDate.getFullYear() &&
      now.getMonth() === cacheDate.getMonth() &&
      now.getDate() === cacheDate.getDate()
    );
  }

  /**
   * Clear expired cache
   */
  async clearExpiredCache(): Promise<RepositoryResult<void>> {
    try {
      const cache = await this.getCachedFeatures();
      if (!cache) {
        return success(undefined);
      }

      if (!this.isCacheValid(cache.cachedAt)) {
        await AsyncStorage.removeItem(CACHE_KEY);
      }

      return success(undefined);
    } catch (error) {
      return databaseError(
        error instanceof Error
          ? error.message
          : 'Failed to clear expired cache',
      );
    }
  }

  /**
   * Get valid auth token via AuthTokenManager (Better Auth / SecureStore)
   */
  private async getAuthToken(): Promise<string> {
    const result = await this.tokenManager.getValidToken();
    if (result.type !== RepositoryResultType.SUCCESS) {
      throw new Error(result.error ?? 'Failed to retrieve auth token');
    }
    return result.data as string;
  }
}
