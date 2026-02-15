/**
 * AudioUploadService Tests
 *
 * Story 6.2 - Task 6.2: Audio upload service with multipart support
 */

import { AudioUploadService } from '../AudioUploadService';
import { database } from '../../../database';
import { RepositoryResultType } from '@/contexts/shared/domain/Result';

// Mock axios for HTTP requests
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock database
jest.mock('../../../database', () => ({
  database: {
    execute: jest.fn(),
  },
}));

describe('AudioUploadService', () => {
  let service: AudioUploadService;
  const mockApiUrl = 'https://api.test.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AudioUploadService(mockApiUrl);
  });

  describe('Constructor', () => {
    it('should initialize with API URL', () => {
      expect(service).toBeInstanceOf(AudioUploadService);
    });
  });

  describe('enqueueUpload()', () => {
    const mockCaptureId = 'capture-123';
    const mockFilePath = '/audio/test.m4a';
    const mockFileSize = 50000;

    it('should create upload queue entry and return upload ID', async () => {
      // Mock database insert
      (database.execute as jest.Mock).mockReturnValue({
        rowsAffected: 1,
      });

      const result = await service.enqueueUpload(mockCaptureId, mockFilePath, mockFileSize);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBeDefined();
      expect(typeof result.data?.uploadId).toBe('string');

      // Verify database insert
      expect(database.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO upload_queue'),
        expect.arrayContaining([
          expect.any(String), // id
          mockCaptureId,
          mockFilePath,
          mockFileSize,
          'pending',
          0.0,
          0,
          expect.any(Number), // created_at
          expect.any(Number), // updated_at
        ]),
      );
    });

    it('should return database error if insert fails', async () => {
      (database.execute as jest.Mock).mockImplementation(() => {
        throw new Error('Database constraint violation');
      });

      const result = await service.enqueueUpload(mockCaptureId, mockFilePath, mockFileSize);

      expect(result.type).toBe(RepositoryResultType.DATABASE_ERROR);
      expect(result.error).toContain('Failed to enqueue upload');
    });

    it('should validate required parameters', async () => {
      const result = await service.enqueueUpload('', mockFilePath, mockFileSize);

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toContain('capture_id');
    });
  });

  describe('uploadFile()', () => {
    const mockUploadId = 'upload-456';
    const mockCaptureId = 'capture-789';
    const mockFilePath = '/audio/large.m4a';
    const mockFileSize = 100 * 1024 * 1024; // 100MB

    beforeEach(() => {
      // Mock FormData
      global.FormData = jest.fn(() => ({
        append: jest.fn(),
      })) as any;
    });

    it('should upload file and update progress', async () => {
      // Mock axios post with progress callback
      mockedAxios.post.mockResolvedValue({
        data: { audioUrl: 'https://minio.test.com/audio/capture-789.m4a' },
        status: 200,
      });

      // Mock database updates
      (database.execute as jest.Mock).mockReturnValue({
        rowsAffected: 1,
      });

      const progressCallback = jest.fn();

      const result = await service.uploadFile(
        mockUploadId,
        mockCaptureId,
        mockFilePath,
        mockFileSize,
        progressCallback,
      );

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.audioUrl).toBe('https://minio.test.com/audio/capture-789.m4a');

      // Verify axios called with correct config
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/uploads/audio'),
        expect.any(Object), // FormData
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
          onUploadProgress: expect.any(Function),
        }),
      );

      // Verify status updated to 'completed' (second call, after 'uploading')
      const calls = (database.execute as jest.Mock).mock.calls;
      const completedCall = calls.find((call) => call[1]?.[0] === 'completed');
      expect(completedCall).toBeDefined();
      expect(completedCall[0]).toContain('UPDATE upload_queue');
    });

    it('should update progress during upload', async () => {
      let capturedProgressFn: ((event: any) => void) | undefined;

      mockedAxios.post.mockImplementation((_url, _data, config) => {
        capturedProgressFn = config?.onUploadProgress;
        return Promise.resolve({
          data: { audioUrl: 'https://minio.test.com/audio/test.m4a' },
          status: 200,
        });
      });

      (database.execute as jest.Mock).mockReturnValue({ rowsAffected: 1 });

      const progressCallback = jest.fn();

      await service.uploadFile(mockUploadId, mockCaptureId, mockFilePath, mockFileSize, progressCallback);

      // Simulate progress events
      expect(capturedProgressFn).toBeDefined();
      if (capturedProgressFn) {
        capturedProgressFn({ loaded: 50000, total: 100000 });
        capturedProgressFn({ loaded: 100000, total: 100000 });
      }

      // Verify progress callback was called
      expect(progressCallback).toHaveBeenCalledWith(expect.any(Number));

      // Verify database progress updates
      const calls = (database.execute as jest.Mock).mock.calls;
      const progressCall = calls.find((call) => call[0].includes('progress ='));
      expect(progressCall).toBeDefined();
    });

    it('should handle network errors and update status to failed', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network timeout'));

      (database.execute as jest.Mock).mockReturnValue({ rowsAffected: 1 });

      const result = await service.uploadFile(mockUploadId, mockCaptureId, mockFilePath, mockFileSize);

      expect(result.type).toBe(RepositoryResultType.NETWORK_ERROR);
      expect(result.error).toContain('Upload failed');

      // Verify status updated to 'failed' with error message
      const calls = (database.execute as jest.Mock).mock.calls;
      const failedCall = calls.find((call) => call[1]?.[0] === 'failed');
      expect(failedCall).toBeDefined();
      expect(failedCall[1]).toContain('Network timeout');
    });

    it('should increment retry_count on failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Server error'));

      (database.execute as jest.Mock).mockReturnValue({ rowsAffected: 1 });

      await service.uploadFile(mockUploadId, mockCaptureId, mockFilePath, mockFileSize);

      // Verify retry_count incremented
      expect(database.execute).toHaveBeenCalledWith(
        expect.stringContaining('retry_count = retry_count + 1'),
        expect.any(Array),
      );
    });
  });

  describe('getPendingUploads()', () => {
    it('should query pending uploads from database', async () => {
      const mockPendingUploads = [
        {
          id: 'upload-1',
          capture_id: 'capture-1',
          file_path: '/audio/1.m4a',
          file_size: 10000,
          status: 'pending',
          retry_count: 0,
        },
        {
          id: 'upload-2',
          capture_id: 'capture-2',
          file_path: '/audio/2.m4a',
          file_size: 20000,
          status: 'pending',
          retry_count: 1,
        },
      ];

      (database.execute as jest.Mock).mockReturnValue({
        rows: mockPendingUploads,
      });

      const result = await service.getPendingUploads();

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].id).toBe('upload-1');

      expect(database.execute).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM upload_queue"),
      );
    });

    it('should return empty array if no pending uploads', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rows: [],
      });

      const result = await service.getPendingUploads();

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      (database.execute as jest.Mock).mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      const result = await service.getPendingUploads();

      expect(result.type).toBe(RepositoryResultType.DATABASE_ERROR);
      expect(result.error).toContain('Failed to get pending uploads');
    });
  });

  describe('getUploadStatus()', () => {
    const mockUploadId = 'upload-999';

    it('should return upload status from database', async () => {
      const mockUpload = {
        id: mockUploadId,
        capture_id: 'capture-999',
        file_path: '/audio/test.m4a',
        file_size: 50000,
        status: 'uploading',
        progress: 0.65,
        retry_count: 0,
      };

      (database.execute as jest.Mock).mockReturnValue({
        rows: [mockUpload],
      });

      const result = await service.getUploadStatus(mockUploadId);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.status).toBe('uploading');
      expect(result.data?.progress).toBe(0.65);

      expect(database.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM upload_queue WHERE id = ?'),
        [mockUploadId],
      );
    });

    it('should return NOT_FOUND if upload does not exist', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rows: [],
      });

      const result = await service.getUploadStatus('non-existent');

      expect(result.type).toBe(RepositoryResultType.NOT_FOUND);
      expect(result.error).toContain('Upload not found');
    });
  });

  describe('deleteUpload()', () => {
    const mockUploadId = 'upload-delete';

    it('should delete upload from queue', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rowsAffected: 1,
      });

      const result = await service.deleteUpload(mockUploadId);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      expect(database.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM upload_queue WHERE id = ?'),
        [mockUploadId],
      );
    });

    it('should return NOT_FOUND if upload does not exist', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rowsAffected: 0,
      });

      const result = await service.deleteUpload('non-existent');

      expect(result.type).toBe(RepositoryResultType.NOT_FOUND);
      expect(result.error).toContain('Upload not found');
    });
  });
});
