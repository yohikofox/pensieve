/**
 * UserFeaturesService Unit Tests
 * Story 7.1: Support Mode avec Permissions Backend
 */

import 'reflect-metadata';
import { UserFeaturesService } from '../user-features.service';
import type { IUserFeaturesRepository } from '../../domain/user-features-repository.interface';
import type { UserFeatures, UserFeaturesCache } from '../../domain/user-features.model';
import { success, databaseError, RepositoryResultType } from '@/contexts/shared/domain/Result';

describe('UserFeaturesService', () => {
  let service: UserFeaturesService;
  let mockRepository: jest.Mocked<IUserFeaturesRepository>;

  const mockFeatures: UserFeatures = {
    debug_mode_access: false,
  };

  beforeEach(() => {
    mockRepository = {
      fetchUserFeatures: jest.fn(),
      getCachedFeatures: jest.fn(),
      saveCachedFeatures: jest.fn(),
      isCacheValid: jest.fn(),
      clearExpiredCache: jest.fn(),
    };

    service = new UserFeaturesService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserFeatures', () => {
    it('should return cached features if valid', async () => {
      const cachedFeatures: UserFeaturesCache = {
        features: mockFeatures,
        cachedAt: Date.now(),
      };

      mockRepository.getCachedFeatures.mockResolvedValue(cachedFeatures);
      mockRepository.isCacheValid.mockReturnValue(true);

      const result = await service.getUserFeatures('user-id');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toEqual(mockFeatures);
      expect(mockRepository.fetchUserFeatures).not.toHaveBeenCalled();
    });

    it('should fetch from server if no cache', async () => {
      mockRepository.getCachedFeatures.mockResolvedValue(null);
      mockRepository.fetchUserFeatures.mockResolvedValue(success(mockFeatures));
      mockRepository.saveCachedFeatures.mockResolvedValue(success(undefined));

      const result = await service.getUserFeatures('user-id');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toEqual(mockFeatures);
      expect(mockRepository.fetchUserFeatures).toHaveBeenCalledWith('user-id');
      expect(mockRepository.saveCachedFeatures).toHaveBeenCalledWith(mockFeatures);
    });

    it('should fetch from server if cache expired', async () => {
      const expiredCache: UserFeaturesCache = {
        features: mockFeatures,
        cachedAt: Date.now() - 86400000, // 24 hours ago
      };

      mockRepository.getCachedFeatures.mockResolvedValue(expiredCache);
      mockRepository.isCacheValid.mockReturnValue(false);
      mockRepository.clearExpiredCache.mockResolvedValue(success(undefined));
      mockRepository.fetchUserFeatures.mockResolvedValue(success(mockFeatures));
      mockRepository.saveCachedFeatures.mockResolvedValue(success(undefined));

      const result = await service.getUserFeatures('user-id');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(mockRepository.clearExpiredCache).toHaveBeenCalled();
      expect(mockRepository.fetchUserFeatures).toHaveBeenCalled();
    });

    it('should force refresh when forceRefresh is true', async () => {
      const cachedFeatures: UserFeaturesCache = {
        features: mockFeatures,
        cachedAt: Date.now(),
      };

      mockRepository.getCachedFeatures.mockResolvedValue(cachedFeatures);
      mockRepository.isCacheValid.mockReturnValue(true);
      mockRepository.fetchUserFeatures.mockResolvedValue(success(mockFeatures));
      mockRepository.saveCachedFeatures.mockResolvedValue(success(undefined));

      const result = await service.getUserFeatures('user-id', true);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(mockRepository.fetchUserFeatures).toHaveBeenCalledWith('user-id');
      expect(mockRepository.saveCachedFeatures).toHaveBeenCalled();
    });

    it('should return cached features if fetch fails', async () => {
      const cachedFeatures: UserFeaturesCache = {
        features: mockFeatures,
        cachedAt: Date.now() - 86400000, // Expired cache
      };

      mockRepository.getCachedFeatures.mockResolvedValue(null);
      mockRepository.isCacheValid.mockReturnValue(false);
      mockRepository.fetchUserFeatures.mockResolvedValue(
        databaseError('Network error')
      );
      mockRepository.getCachedFeatures.mockResolvedValueOnce(null).mockResolvedValueOnce(cachedFeatures);

      const result = await service.getUserFeatures('user-id');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toEqual(mockFeatures);
    });

    it('should return default safe features if no cache and fetch fails', async () => {
      mockRepository.getCachedFeatures.mockResolvedValue(null);
      mockRepository.fetchUserFeatures.mockResolvedValue(
        databaseError('Network error')
      );

      const result = await service.getUserFeatures('user-id');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toEqual({ debug_mode_access: false });
    });
  });

  describe('refreshUserFeatures', () => {
    it('should force fetch from server', async () => {
      mockRepository.fetchUserFeatures.mockResolvedValue(success(mockFeatures));
      mockRepository.saveCachedFeatures.mockResolvedValue(success(undefined));

      const result = await service.refreshUserFeatures('user-id');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toEqual(mockFeatures);
      expect(mockRepository.fetchUserFeatures).toHaveBeenCalledWith('user-id');
    });
  });

  describe('Bug Fix: getCachedFeaturesIfValid error handling', () => {
    /**
     * Bug reproduction: Line 110 uses failure() which doesn't exist in Result.ts
     * Expected exports: success(), notFound(), databaseError(), validationError()
     *
     * Scenario: getCachedFeatures() throws exception → catch block uses failure()
     * Expected: Should return databaseError() instead
     */
    it('should handle database errors when getting cached features', async () => {
      // ARRANGE - Mock getCachedFeatures to throw exception
      const dbError = new Error('SQLite connection lost');
      mockRepository.getCachedFeatures.mockRejectedValue(dbError);
      mockRepository.fetchUserFeatures.mockResolvedValue(success(mockFeatures));
      mockRepository.saveCachedFeatures.mockResolvedValue(success(undefined));

      // ACT - Call getUserFeatures (triggers getCachedFeaturesIfValid internally)
      const result = await service.getUserFeatures('user-id');

      // ASSERT - Should gracefully handle error and fetch from server
      // Bug: This will fail with ReferenceError: failure is not defined
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toEqual(mockFeatures);
      expect(mockRepository.fetchUserFeatures).toHaveBeenCalledWith('user-id');
    });

    it('should return databaseError when cache read fails and fetch also fails', async () => {
      // ARRANGE - Both cache and fetch fail
      const cacheError = new Error('SQLite connection lost');
      const fetchError = databaseError('Network timeout');

      mockRepository.getCachedFeatures.mockRejectedValue(cacheError);
      mockRepository.fetchUserFeatures.mockResolvedValue(fetchError);

      // ACT
      const result = await service.getUserFeatures('user-id');

      // ASSERT - Should return database error (no fallback possible when cache throws)
      expect(result.type).toBe(RepositoryResultType.DATABASE_ERROR);
      expect(result.error).toContain('SQLite connection lost');
    });
  });
});
