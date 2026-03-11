import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminPermissionFeaturesController } from '../admin-permission-features.controller';
import { AdminFeatureFlagsService } from '../../../application/services/admin-feature-flags.service';
import { AdminGuard } from '../../../../admin-auth/infrastructure/guards/admin.guard';
import { UpsertFeatureAssignmentDto } from '../../../application/dtos/upsert-feature-assignment.dto';

describe('AdminPermissionFeaturesController', () => {
  let controller: AdminPermissionFeaturesController;

  const mockService: Partial<AdminFeatureFlagsService> = {
    getPermissionAssignments: jest.fn(),
    upsertPermissionAssignment: jest.fn(),
    deletePermissionAssignment: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPermissionFeaturesController],
      providers: [
        { provide: AdminFeatureFlagsService, useValue: mockService },
        { provide: AdminGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AdminPermissionFeaturesController>(
      AdminPermissionFeaturesController,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPermissionAssignments', () => {
    it('should return feature assignments for a permission', async () => {
      const assignments = [{ featureKey: 'data_mining', value: true }];
      (mockService.getPermissionAssignments as jest.Mock).mockResolvedValue(
        assignments,
      );

      const result = await controller.getPermissionAssignments('perm-001');

      expect(result).toEqual(assignments);
      expect(mockService.getPermissionAssignments).toHaveBeenCalledWith(
        'perm-001',
      );
    });
  });

  describe('upsertAssignment', () => {
    it('should upsert and return the assignment', async () => {
      const dto: UpsertFeatureAssignmentDto = { value: true };
      const expected = {
        key: 'data_mining',
        value: true,
        source: 'permission',
      };
      (mockService.upsertPermissionAssignment as jest.Mock).mockResolvedValue(
        expected,
      );

      const result = await controller.upsertAssignment(
        'perm-001',
        'data_mining',
        dto,
      );

      expect(result).toEqual(expected);
      expect(mockService.upsertPermissionAssignment).toHaveBeenCalledWith(
        'perm-001',
        'data_mining',
        true,
      );
    });

    it('should propagate NotFoundException for unknown feature key', async () => {
      (mockService.upsertPermissionAssignment as jest.Mock).mockRejectedValue(
        new NotFoundException("Feature 'unknown' not found"),
      );

      await expect(
        controller.upsertAssignment('perm-001', 'unknown', { value: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAssignment', () => {
    it('should delete the assignment', async () => {
      (mockService.deletePermissionAssignment as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.deleteAssignment('perm-001', 'data_mining');

      expect(mockService.deletePermissionAssignment).toHaveBeenCalledWith(
        'perm-001',
        'data_mining',
      );
    });
  });
});
