import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserFeaturesService } from './user-features.service';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { FeatureResolutionService } from '../../../feature-flags/application/services/feature-resolution.service';

const MOCK_FEATURES: Record<string, boolean> = {
  debug_mode: false,
  data_mining: false,
  news_tab: false,
  projects_tab: false,
  capture_media_buttons: false,
};

describe('UserFeaturesService', () => {
  let service: UserFeaturesService;

  const mockUserRepository = {
    existsBy: jest.fn(),
  };

  const mockFeatureResolutionService = {
    resolveFeatures: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserFeaturesService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: FeatureResolutionService,
          useValue: mockFeatureResolutionService,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<UserFeaturesService>(UserFeaturesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserFeatures', () => {
    it('should delegate to FeatureResolutionService and return Record<string, boolean>', async () => {
      mockUserRepository.existsBy.mockResolvedValue(true);
      mockFeatureResolutionService.resolveFeatures.mockResolvedValue({
        ...MOCK_FEATURES,
        debug_mode: true,
      });

      const result = await service.getUserFeatures('test-user-id');

      expect(result).toEqual({ ...MOCK_FEATURES, debug_mode: true });
      expect(mockFeatureResolutionService.resolveFeatures).toHaveBeenCalledWith('test-user-id');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepository.existsBy.mockResolvedValue(false);

      await expect(service.getUserFeatures('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return all features as false for user without assignments', async () => {
      mockUserRepository.existsBy.mockResolvedValue(true);
      mockFeatureResolutionService.resolveFeatures.mockResolvedValue(MOCK_FEATURES);

      const result = await service.getUserFeatures('test-user-id');

      expect(Object.values(result)).toEqual(expect.arrayContaining([false]));
      expect(Object.keys(result)).toEqual(expect.arrayContaining(['debug_mode', 'data_mining']));
    });
  });

  describe('updateFeatures', () => {
    it('should upsert debug_mode assignment when debug_mode_access is provided', async () => {
      mockUserRepository.existsBy.mockResolvedValue(true);
      mockDataSource.query.mockResolvedValue([]);
      mockFeatureResolutionService.resolveFeatures.mockResolvedValue({
        ...MOCK_FEATURES,
        debug_mode: true,
      });

      const result = await service.updateFeatures('test-user-id', {
        debug_mode_access: true,
      });

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('user_feature_assignments'),
        ['test-user-id', true, 'debug_mode'],
      );
      expect(result['debug_mode']).toBe(true);
    });

    it('should upsert data_mining assignment when data_mining_access is provided', async () => {
      mockUserRepository.existsBy.mockResolvedValue(true);
      mockDataSource.query.mockResolvedValue([]);
      mockFeatureResolutionService.resolveFeatures.mockResolvedValue({
        ...MOCK_FEATURES,
        data_mining: true,
      });

      await service.updateFeatures('test-user-id', { data_mining_access: true });

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('user_feature_assignments'),
        ['test-user-id', true, 'data_mining'],
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepository.existsBy.mockResolvedValue(false);

      await expect(
        service.updateFeatures('non-existent-id', { debug_mode_access: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not call query when no patch fields provided', async () => {
      mockUserRepository.existsBy.mockResolvedValue(true);
      mockFeatureResolutionService.resolveFeatures.mockResolvedValue(MOCK_FEATURES);

      await service.updateFeatures('test-user-id', {});

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });
});
