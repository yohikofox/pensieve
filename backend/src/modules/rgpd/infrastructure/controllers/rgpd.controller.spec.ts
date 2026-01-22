import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { RgpdController } from './rgpd.controller';
import { RgpdService } from '../../application/services/rgpd.service';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import type { Response } from 'express';

describe('RgpdController', () => {
  let controller: RgpdController;
  let rgpdService: RgpdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RgpdController],
      providers: [
        {
          provide: RgpdService,
          useValue: {
            generateExport: jest.fn(),
            deleteUserAccount: jest.fn(),
            verifyPassword: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = { id: 'user-123', email: 'test@example.com' };
          return true;
        },
      })
      .compile();

    controller = module.get<RgpdController>(RgpdController);
    rgpdService = module.get<RgpdService>(RgpdService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportUserData', () => {
    it('should return ZIP file for export', async () => {
      // Arrange
      const userId = 'user-123';
      const mockBuffer = Buffer.from('mock-zip-content');
      const mockRequest = {
        user: { id: userId, email: 'test@example.com' },
      } as any;
      const mockResponse = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      jest.spyOn(rgpdService, 'generateExport').mockResolvedValue(mockBuffer);

      // Act
      await controller.exportUserData(mockRequest, mockResponse);

      // Assert
      expect(rgpdService.generateExport).toHaveBeenCalledWith(
        userId,
        mockRequest,
      );
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/zip',
        'Content-Disposition': expect.stringContaining('attachment'),
        'Content-Length': mockBuffer.length,
      });
      expect(mockResponse.send).toHaveBeenCalledWith(mockBuffer);
    });

    it('should return 500 error if export fails', async () => {
      // Arrange
      const userId = 'user-123';
      const mockRequest = {
        user: { id: userId, email: 'test@example.com' },
      } as any;
      const mockResponse = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      jest
        .spyOn(rgpdService, 'generateExport')
        .mockRejectedValue(new Error('Export failed'));

      // Act
      await controller.exportUserData(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Export failed',
        message: 'Export failed',
      });
    });

    it('should include timestamp in filename', async () => {
      // Arrange
      const userId = 'user-123';
      const mockBuffer = Buffer.from('mock-zip-content');
      const mockRequest = {
        user: { id: userId, email: 'test@example.com' },
      } as any;
      const mockResponse = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      jest.spyOn(rgpdService, 'generateExport').mockResolvedValue(mockBuffer);

      // Act
      await controller.exportUserData(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition': expect.stringMatching(
            /attachment; filename="pensine-export-user-123-\d+\.zip"/,
          ),
        }),
      );
    });
  });

  describe('deleteUserAccount', () => {
    it('should delete account when password is valid', async () => {
      // Arrange
      const userId = 'user-123';
      const email = 'test@example.com';
      const password = 'ValidPassword123';
      const mockRequest = {
        user: { id: userId, email },
      } as any;
      const mockBody = { password };

      jest.spyOn(rgpdService, 'verifyPassword').mockResolvedValue(true);
      jest.spyOn(rgpdService, 'deleteUserAccount').mockResolvedValue(undefined);

      // Act
      const result = await controller.deleteUserAccount(mockRequest, mockBody);

      // Assert
      expect(rgpdService.verifyPassword).toHaveBeenCalledWith(email, password);
      expect(rgpdService.deleteUserAccount).toHaveBeenCalledWith(
        userId,
        mockRequest,
      );
      expect(result).toBeUndefined(); // 204 No Content
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      // Arrange
      const userId = 'user-123';
      const email = 'test@example.com';
      const password = 'WrongPassword';
      const mockRequest = {
        user: { id: userId, email },
      } as any;
      const mockBody = { password };

      jest.spyOn(rgpdService, 'verifyPassword').mockResolvedValue(false);

      // Act & Assert
      await expect(
        controller.deleteUserAccount(mockRequest, mockBody),
      ).rejects.toThrow(UnauthorizedException);
      expect(rgpdService.verifyPassword).toHaveBeenCalledWith(email, password);
      expect(rgpdService.deleteUserAccount).not.toHaveBeenCalled();
    });

    it('should verify password before deleting account', async () => {
      // Arrange
      const userId = 'user-123';
      const email = 'test@example.com';
      const password = 'ValidPassword123';
      const mockRequest = {
        user: { id: userId, email },
      } as any;
      const mockBody = { password };

      const verifyPasswordSpy = jest
        .spyOn(rgpdService, 'verifyPassword')
        .mockResolvedValue(true);
      const deleteAccountSpy = jest
        .spyOn(rgpdService, 'deleteUserAccount')
        .mockResolvedValue(undefined);

      // Act
      await controller.deleteUserAccount(mockRequest, mockBody);

      // Assert
      expect(verifyPasswordSpy).toHaveBeenCalledBefore(deleteAccountSpy);
    });

    it('should use user email from request', async () => {
      // Arrange
      const userId = 'user-123';
      const email = 'specific@example.com';
      const password = 'ValidPassword123';
      const mockRequest = {
        user: { id: userId, email },
      } as any;
      const mockBody = { password };

      jest.spyOn(rgpdService, 'verifyPassword').mockResolvedValue(true);
      jest.spyOn(rgpdService, 'deleteUserAccount').mockResolvedValue(undefined);

      // Act
      await controller.deleteUserAccount(mockRequest, mockBody);

      // Assert
      expect(rgpdService.verifyPassword).toHaveBeenCalledWith(email, password);
    });

    it('should throw UnauthorizedException with message "Invalid password"', async () => {
      // Arrange
      const userId = 'user-123';
      const email = 'test@example.com';
      const password = 'WrongPassword';
      const mockRequest = {
        user: { id: userId, email },
      } as any;
      const mockBody = { password };

      jest.spyOn(rgpdService, 'verifyPassword').mockResolvedValue(false);

      // Act & Assert
      try {
        await controller.deleteUserAccount(mockRequest, mockBody);
        fail('Should have thrown UnauthorizedException');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid password');
      }
    });
  });
});

// Helper to check call order
expect.extend({
  toHaveBeenCalledBefore(received, expected) {
    const receivedCalls = received.mock.invocationCallOrder;
    const expectedCalls = expected.mock.invocationCallOrder;

    const pass =
      receivedCalls.length > 0 &&
      expectedCalls.length > 0 &&
      receivedCalls[0] < expectedCalls[0];

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received.getMockName()} not to have been called before ${expected.getMockName()}`
          : `expected ${received.getMockName()} to have been called before ${expected.getMockName()}`,
    };
  },
});
