import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminRoleFeaturesController } from '../admin-role-features.controller';
import { AdminFeatureFlagsService } from '../../../application/services/admin-feature-flags.service';
import { AdminJwtGuard } from '../../../../admin-auth/infrastructure/guards/admin-jwt.guard';
import { UpsertFeatureAssignmentDto } from '../../../application/dtos/upsert-feature-assignment.dto';

describe('AdminRoleFeaturesController', () => {
  let controller: AdminRoleFeaturesController;

  const mockService: Partial<AdminFeatureFlagsService> = {
    getRoleAssignments: jest.fn(),
    upsertRoleAssignment: jest.fn(),
    deleteRoleAssignment: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminRoleFeaturesController],
      providers: [
        { provide: AdminFeatureFlagsService, useValue: mockService },
        { provide: AdminJwtGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AdminRoleFeaturesController>(AdminRoleFeaturesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRoleAssignments', () => {
    it('should return feature assignments for a role', async () => {
      const assignments = [{ featureKey: 'news_tab', value: true }];
      (mockService.getRoleAssignments as jest.Mock).mockResolvedValue(assignments);

      const result = await controller.getRoleAssignments('role-beta');

      expect(result).toEqual(assignments);
      expect(mockService.getRoleAssignments).toHaveBeenCalledWith('role-beta');
    });
  });

  describe('upsertAssignment', () => {
    it('should upsert and return the assignment', async () => {
      const dto: UpsertFeatureAssignmentDto = { value: false };
      const expected = { key: 'debug_mode', value: false, source: 'role' };
      (mockService.upsertRoleAssignment as jest.Mock).mockResolvedValue(expected);

      const result = await controller.upsertAssignment('role-beta', 'debug_mode', dto);

      expect(result).toEqual(expected);
      expect(mockService.upsertRoleAssignment).toHaveBeenCalledWith(
        'role-beta',
        'debug_mode',
        false,
      );
    });

    it('should propagate NotFoundException for unknown feature key', async () => {
      (mockService.upsertRoleAssignment as jest.Mock).mockRejectedValue(
        new NotFoundException("Feature 'unknown' not found"),
      );

      await expect(
        controller.upsertAssignment('role-beta', 'unknown', { value: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAssignment', () => {
    it('should delete the assignment', async () => {
      (mockService.deleteRoleAssignment as jest.Mock).mockResolvedValue(undefined);

      await controller.deleteAssignment('role-beta', 'debug_mode');

      expect(mockService.deleteRoleAssignment).toHaveBeenCalledWith(
        'role-beta',
        'debug_mode',
      );
    });
  });
});
