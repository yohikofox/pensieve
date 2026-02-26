import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { BetterAuthAdminService } from '../../../rgpd/application/services/better-auth-admin.service';
import { RgpdService } from '../../../rgpd/application/services/rgpd.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;

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
    syncUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
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

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('syncUsers', () => {
    it('should sync users and return result with message', async () => {
      const syncResult = { created: 2, updated: 1, unchanged: 5 };
      mockRgpdService.syncUsers.mockResolvedValue(syncResult);

      const result = await controller.syncUsers();

      expect(result).toEqual({ message: 'Sync completed', ...syncResult });
      expect(mockRgpdService.syncUsers).toHaveBeenCalled();
    });

    it('should propagate errors from RgpdService', async () => {
      mockRgpdService.syncUsers.mockRejectedValue(new Error('Sync failed'));

      await expect(controller.syncUsers()).rejects.toThrow('Sync failed');
    });
  });

  describe('resetUserPassword', () => {
    it('should reset password and return success message', async () => {
      mockBetterAuthAdminService.resetUserPassword.mockResolvedValue(undefined);

      const result = await controller.resetUserPassword('test-user-id', {
        newPassword: 'NewPass123!',
      });

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(mockBetterAuthAdminService.resetUserPassword).toHaveBeenCalledWith(
        'test-user-id',
        'NewPass123!',
      );
    });
  });
});
