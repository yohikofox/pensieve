import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminFeaturesController } from '../admin-features.controller';
import { AdminFeatureFlagsService } from '../../../application/services/admin-feature-flags.service';
import { AdminJwtGuard } from '../../../../admin-auth/infrastructure/guards/admin-jwt.guard';
import { CreateFeatureDto } from '../../../application/dtos/create-feature.dto';
import { UpdateFeatureDto } from '../../../application/dtos/update-feature.dto';
import { Feature } from '../../../domain/entities/feature.entity';

const mockFeature = (overrides: Partial<Feature> = {}): Feature =>
  ({
    id: 'fe-001',
    key: 'debug_mode',
    description: 'Enable debug overlay',
    defaultValue: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as Feature;

describe('AdminFeaturesController', () => {
  let controller: AdminFeaturesController;

  const mockService: Partial<AdminFeatureFlagsService> = {
    listFeatures: jest.fn(),
    createFeature: jest.fn(),
    updateFeature: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFeaturesController],
      providers: [
        { provide: AdminFeatureFlagsService, useValue: mockService },
        { provide: AdminJwtGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AdminFeaturesController>(AdminFeaturesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listFeatures', () => {
    it('should return the list of features', async () => {
      const features = [mockFeature(), mockFeature({ key: 'news_tab', id: 'fe-002' })];
      (mockService.listFeatures as jest.Mock).mockResolvedValue(features);

      const result = await controller.listFeatures();

      expect(result).toEqual(features);
      expect(mockService.listFeatures).toHaveBeenCalledTimes(1);
    });
  });

  describe('createFeature', () => {
    it('should create and return a feature', async () => {
      const dto: CreateFeatureDto = { key: 'new_feature', description: 'desc', defaultValue: false };
      const created = mockFeature({ key: 'new_feature' });
      (mockService.createFeature as jest.Mock).mockResolvedValue(created);

      const result = await controller.createFeature(dto);

      expect(result).toEqual(created);
      expect(mockService.createFeature).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateFeature', () => {
    it('should update and return the feature', async () => {
      const dto: UpdateFeatureDto = { description: 'updated desc' };
      const updated = mockFeature({ description: 'updated desc' });
      (mockService.updateFeature as jest.Mock).mockResolvedValue(updated);

      const result = await controller.updateFeature('fe-001', dto);

      expect(result).toEqual(updated);
      expect(mockService.updateFeature).toHaveBeenCalledWith('fe-001', dto);
    });

    it('should propagate NotFoundException when feature not found', async () => {
      (mockService.updateFeature as jest.Mock).mockRejectedValue(
        new NotFoundException("Feature with id 'fe-xxx' not found"),
      );

      await expect(
        controller.updateFeature('fe-xxx', { description: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
