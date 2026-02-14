/**
 * UserFeaturesRepository Unit Tests
 * Story 7.1: Support Mode avec Permissions Backend
 */

import 'reflect-metadata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserFeaturesRepository } from '../user-features.repository';
import type { UserFeatures, UserFeaturesCache } from '../../domain/user-features.model';
import { RepositoryResultType } from '@/contexts/shared/domain/Result';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock fetch
global.fetch = jest.fn();

// Mock apiConfig
jest.mock('@/config/api', () => ({
  apiConfig: {
    endpoints: {
      users: {
        features: (userId: string) => `http://localhost:3000/api/users/${userId}/features`,
      },
    },
  },
}));

describe('UserFeaturesRepository', () => {
  let repository: UserFeaturesRepository;

  const mockFeatures: UserFeatures = {
    debug_mode_access: true,
  };

  beforeEach(() => {
    repository = new UserFeaturesRepository();
    jest.clearAllMocks();
  });

  describe('fetchUserFeatures', () => {
    it('should return database error due to auth not implemented', async () => {
      // getAuthToken() throws error since auth integration is not yet implemented
      const result = await repository.fetchUserFeatures('user-id');

      expect(result.type).toBe(RepositoryResultType.DATABASE_ERROR);
      expect(result.error).toContain('Auth token retrieval not yet implemented');
    });
  });

  describe('getCachedFeatures', () => {
    it('should return cached features', async () => {
      const cache: UserFeaturesCache = {
        features: mockFeatures,
        cachedAt: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cache));

      const result = await repository.getCachedFeatures();

      expect(result).toEqual(cache);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@pensieve:userFeatures');
    });

    it('should return null if no cache', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await repository.getCachedFeatures();

      expect(result).toBeNull();
    });

    it('should return null if cache is invalid JSON', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json');

      const result = await repository.getCachedFeatures();

      expect(result).toBeNull();
    });
  });

  describe('saveCachedFeatures', () => {
    it('should save features to cache', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const cachedAt = Date.now();
      const result = await repository.saveCachedFeatures(mockFeatures, cachedAt);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pensieve:userFeatures',
        JSON.stringify({
          features: mockFeatures,
          cachedAt,
        })
      );
    });

    it('should use current time if cachedAt not provided', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const beforeTime = Date.now();
      const result = await repository.saveCachedFeatures(mockFeatures);
      const afterTime = Date.now();

      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedCache = JSON.parse(setItemCall[1]) as UserFeaturesCache;

      expect(savedCache.cachedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(savedCache.cachedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('isCacheValid', () => {
    it('should return true if cache is valid (before midnight)', () => {
      // Cache from earlier today (10:00 AM)
      const today = new Date();
      today.setHours(10, 0, 0, 0);
      const cachedAt = today.getTime();

      const result = repository.isCacheValid(cachedAt);

      expect(result).toBe(true);
    });

    it('should return false if cache expired (after midnight)', () => {
      // Cache from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);

      const result = repository.isCacheValid(yesterday.getTime());

      expect(result).toBe(false);
    });

    it('should return true if cached today before midnight', () => {
      // Cache from this morning
      const today = new Date();
      today.setHours(8, 0, 0, 0);

      const result = repository.isCacheValid(today.getTime());

      expect(result).toBe(true);
    });
  });

  describe('clearExpiredCache', () => {
    it('should clear cache if expired', async () => {
      const expiredCache: UserFeaturesCache = {
        features: mockFeatures,
        cachedAt: Date.now() - 86400000, // Yesterday
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(expiredCache)
      );
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const result = await repository.clearExpiredCache();

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pensieve:userFeatures');
    });

    it('should not clear cache if valid', async () => {
      const validCache: UserFeaturesCache = {
        features: mockFeatures,
        cachedAt: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(validCache)
      );

      const result = await repository.clearExpiredCache();

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should succeed if no cache exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await repository.clearExpiredCache();

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });
  });
});
