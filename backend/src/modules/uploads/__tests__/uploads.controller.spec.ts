/**
 * Uploads Controller Tests
 *
 * Story 6.2 - Task 7.2: Backend audio upload endpoint
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UploadsController } from '../application/controllers/uploads.controller';
import { MinioService } from '../../shared/infrastructure/storage/minio.service';
import { Capture } from '../../capture/domain/entities/capture.entity';
import { BetterAuthGuard } from '../../../auth/guards/better-auth.guard';

describe('UploadsController', () => {
  const BACKEND_URL = 'http://api.example.local:3000';

  let controller: UploadsController;
  let minioService: jest.Mocked<MinioService>;
  let captureRepository: { update: jest.Mock };

  beforeEach(async () => {
    // Mock MinioService
    const mockMinioService = {
      putObject: jest.fn(),
      getObjectStream: jest.fn(),
    };

    // Mock CaptureRepository
    const mockCaptureRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // Mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue = '') => {
        if (key === 'BETTER_AUTH_URL') return BACKEND_URL;
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        {
          provide: MinioService,
          useValue: mockMinioService,
        },
        {
          provide: getRepositoryToken(Capture),
          useValue: mockCaptureRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })
      .overrideGuard(BetterAuthGuard)
      .useValue({ canActivate: () => true }) // Bypass auth in tests
      .compile();

    controller = module.get<UploadsController>(UploadsController);
    minioService = module.get(MinioService);
    captureRepository = module.get(getRepositoryToken(Capture));
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

    it('should upload audio file to MinIO with user isolation and return backend proxy URL', async () => {
      const captureId = 'capture-456';

      minioService.putObject.mockResolvedValue(
        'audio/user-123/capture-456.m4a',
      );

      const result = await controller.uploadAudio(
        mockFile,
        { captureId },
        mockRequest as any,
      );

      // Returns backend proxy URL (not MinIO path — MinIO is not internet-exposed)
      expect(result).toEqual({
        audioUrl: `${BACKEND_URL}/api/uploads/audio/capture-456`,
      });

      // Verify MinioService called with correct params
      expect(minioService.putObject).toHaveBeenCalledWith(
        'audio/user-123/capture-456.m4a',
        mockFile.buffer,
        mockFile.mimetype,
      );
    });

    it('should update capture.rawContent with MinIO key after upload (BUG 3 fix)', async () => {
      const captureId = 'capture-456';
      const expectedKey = 'audio/user-123/capture-456.m4a';

      minioService.putObject.mockResolvedValue(expectedKey);
      captureRepository.update.mockResolvedValue({ affected: 1 });

      await controller.uploadAudio(mockFile, { captureId }, mockRequest as any);

      expect(captureRepository.update).toHaveBeenCalledWith(
        { clientId: captureId, ownerId: 'user-123' },
        expect.objectContaining({ rawContent: expectedKey }),
      );
    });

    it('should still return audioUrl even when capture not found in DB (no throw)', async () => {
      const captureId = 'orphan-capture';

      minioService.putObject.mockResolvedValue('audio/user-123/orphan-capture.m4a');
      captureRepository.update.mockResolvedValue({ affected: 0 });

      const result = await controller.uploadAudio(
        mockFile,
        { captureId },
        mockRequest as any,
      );

      // Upload should succeed even if capture row not found (PUSH may come later)
      expect(result).toEqual({
        audioUrl: `${BACKEND_URL}/api/uploads/audio/orphan-capture`,
      });
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
