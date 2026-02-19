import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { UserFeaturesService } from '../../../identity/application/services/user-features.service';
import { BetterAuthAdminService } from '../../../rgpd/application/services/better-auth-admin.service';
import { RgpdService } from '../../../rgpd/application/services/rgpd.service';
import { UserFeaturesDto } from '../../../identity/application/dtos/user-features.dto';
import { UpdateUserFeaturesDto } from '../../application/dtos/update-user-features.dto';
import { NotFoundException } from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let userFeaturesService: UserFeaturesService;

  const mockUserFeaturesService = {
    getUserFeatures: jest.fn(),
    updateDebugModeAccess: jest.fn(),
  };

  const mockAdminJwtGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockBetterAuthAdminService = {
    resetUserPassword: jest.fn(),
    getUserProfile: jest.fn(),
    deleteUser: jest.fn(),
    verifyPassword: jest.fn(),
    listAllUsers: jest.fn(),
  };

  const mockRgpdService = {
    syncUsersFromSupabase: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        {
          provide: UserFeaturesService,
          useValue: mockUserFeaturesService,
        },
        {
          provide: BetterAuthAdminService,
          useValue: mockBetterAuthAdminService,
        },
        {
          provide: RgpdService,
          useValue: mockRgpdService,
        },
        {
          provide: AdminJwtGuard,
          useValue: mockAdminJwtGuard,
        },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue(mockAdminJwtGuard)
      .compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
    userFeaturesService = module.get<UserFeaturesService>(UserFeaturesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserFeatures', () => {
    it('should return user features', async () => {
      const expectedDto: UserFeaturesDto = { debug_mode_access: false };
      mockUserFeaturesService.getUserFeatures.mockResolvedValue(expectedDto);

      const result = await controller.getUserFeatures('test-user-id');

      expect(result).toEqual(expectedDto);
      expect(mockUserFeaturesService.getUserFeatures).toHaveBeenCalledWith(
        'test-user-id',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserFeaturesService.getUserFeatures.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.getUserFeatures('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserFeatures', () => {
    it('should update debug_mode_access to true', async () => {
      const dto: UpdateUserFeaturesDto = { debug_mode_access: true };
      const expectedDto: UserFeaturesDto = { debug_mode_access: true };
      mockUserFeaturesService.updateDebugModeAccess.mockResolvedValue(
        expectedDto,
      );

      const result = await controller.updateUserFeatures('test-user-id', dto);

      expect(result).toEqual(expectedDto);
      expect(
        mockUserFeaturesService.updateDebugModeAccess,
      ).toHaveBeenCalledWith('test-user-id', true);
    });

    it('should update debug_mode_access to false', async () => {
      const dto: UpdateUserFeaturesDto = { debug_mode_access: false };
      const expectedDto: UserFeaturesDto = { debug_mode_access: false };
      mockUserFeaturesService.updateDebugModeAccess.mockResolvedValue(
        expectedDto,
      );

      const result = await controller.updateUserFeatures('test-user-id', dto);

      expect(result).toEqual(expectedDto);
      expect(
        mockUserFeaturesService.updateDebugModeAccess,
      ).toHaveBeenCalledWith('test-user-id', false);
    });

    it('should throw NotFoundException when user not found', async () => {
      const dto: UpdateUserFeaturesDto = { debug_mode_access: true };
      mockUserFeaturesService.updateDebugModeAccess.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.updateUserFeatures('non-existent-id', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
