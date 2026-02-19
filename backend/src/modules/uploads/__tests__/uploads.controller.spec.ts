/**
 * Uploads Controller Tests
 *
 * Story 6.2 - Task 7.2: Backend audio upload endpoint
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from '../application/controllers/uploads.controller';
import { MinioService } from '../../shared/infrastructure/storage/minio.service';
import { BetterAuthGuard } from '../../../auth/guards/better-auth.guard';

describe('UploadsController', () => {
  let controller: UploadsController;
  let minioService: jest.Mocked<MinioService>;

  beforeEach(async () => {
    // Mock MinioService
    const mockMinioService = {
      putObject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        {
          provide: MinioService,
          useValue: mockMinioService,
        },
      ],
    })
      .overrideGuard(BetterAuthGuard)
      .useValue({ canActivate: () => true }) // Bypass auth in tests
      .compile();

    controller = module.get<UploadsController>(UploadsController);
    minioService = module.get(MinioService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadAudio', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.m4a',
      encoding: '7bit',
      mimetype: 'audio/m4a',
      buffer: Buffer.from('test audio data'),
      size: 1000,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const mockRequest = {
      user: {
        id: 'user-123',
      },
    };

    it('should upload audio file to MinIO with user isolation', async () => {
      const captureId = 'capture-456';

      minioService.putObject.mockResolvedValue(
        'audio/user-123/capture-456.m4a',
      );

      const result = await controller.uploadAudio(
        mockFile,
        { captureId },
        mockRequest as any,
      );

      expect(result).toEqual({
        audioUrl: 'audio/user-123/capture-456.m4a',
      });

      // Verify MinioService called with correct params
      expect(minioService.putObject).toHaveBeenCalledWith(
        'audio/user-123/capture-456.m4a',
        mockFile.buffer,
        mockFile.mimetype,
      );
    });

    it('should reject if captureId missing', async () => {
      await expect(
        controller.uploadAudio(mockFile, {}, mockRequest as any),
      ).rejects.toThrow('captureId is required');
    });

    it('should reject if file missing', async () => {
      await expect(
        controller.uploadAudio(
          null,
          { captureId: 'capture-456' },
          mockRequest as any,
        ),
      ).rejects.toThrow('No file uploaded');
    });

    it('should reject invalid file types', async () => {
      const invalidFile = { ...mockFile, mimetype: 'image/png' };

      await expect(
        controller.uploadAudio(
          invalidFile,
          { captureId: 'capture-456' },
          mockRequest as any,
        ),
      ).rejects.toThrow('Invalid file type');
    });

    it('should reject files larger than 500MB', async () => {
      const largeFile = { ...mockFile, size: 600 * 1024 * 1024 }; // 600MB

      await expect(
        controller.uploadAudio(
          largeFile,
          { captureId: 'capture-456' },
          mockRequest as any,
        ),
      ).rejects.toThrow('File too large');
    });

    it('should handle MinIO upload errors', async () => {
      minioService.putObject.mockRejectedValue(
        new Error('MinIO connection failed'),
      );

      await expect(
        controller.uploadAudio(
          mockFile,
          { captureId: 'capture-456' },
          mockRequest as any,
        ),
      ).rejects.toThrow('Upload failed: MinIO connection failed');
    });
  });
});
