import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminUserFeaturesController } from '../admin-user-features.controller';
import { AdminFeatureFlagsService } from '../../../application/services/admin-feature-flags.service';
import { AdminJwtGuard } from '../../../../admin-auth/infrastructure/guards/admin-jwt.guard';
import { UpsertFeatureAssignmentDto } from '../../../application/dtos/upsert-feature-assignment.dto';

describe('AdminUserFeaturesController', () => {
  let controller: AdminUserFeaturesController;

  const mockService: Partial<AdminFeatureFlagsService> = {
    getUserFeatures: jest.fn(),
    upsertUserAssignment: jest.fn(),
    deleteUserAssignment: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUserFeaturesController],
      providers: [
        { provide: AdminFeatureFlagsService, useValue: mockService },
        { provide: AdminJwtGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AdminUserFeaturesController>(AdminUserFeaturesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserFeatures', () => {
    it('should return resolved features for a user', async () => {
      const resolved: Record<string, boolean> = {
        debug_mode: false,
        news_tab: true,
      };
      (mockService.getUserFeatures as jest.Mock).mockResolvedValue(resolved);

      const result = await controller.getUserFeatures('user-123');

      expect(result).toEqual(resolved);
      expect(mockService.getUserFeatures).toHaveBeenCalledWith('user-123');
    });
  });

  describe('upsertAssignment', () => {
    it('should upsert and return the assignment', async () => {
      const dto: UpsertFeatureAssignmentDto = { value: true };
      const expected = { key: 'news_tab', value: true, source: 'user' };
      (mockService.upsertUserAssignment as jest.Mock).mockResolvedValue(expected);

      const result = await controller.upsertAssignment('user-123', 'news_tab', dto);

      expect(result).toEqual(expected);
      expect(mockService.upsertUserAssignment).toHaveBeenCalledWith(
        'user-123',
        'news_tab',
        true,
      );
    });

    it('should propagate NotFoundException for unknown feature key', async () => {
      (mockService.upsertUserAssignment as jest.Mock).mockRejectedValue(
        new NotFoundException("Feature 'unknown_key' not found"),
      );

      await expect(
        controller.upsertAssignment('user-123', 'unknown_key', { value: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAssignment', () => {
    it('should delete the assignment (204 no content)', async () => {
      (mockService.deleteUserAssignment as jest.Mock).mockResolvedValue(undefined);

      await controller.deleteAssignment('user-123', 'news_tab');

      expect(mockService.deleteUserAssignment).toHaveBeenCalledWith(
        'user-123',
        'news_tab',
      );
    });
  });
});
