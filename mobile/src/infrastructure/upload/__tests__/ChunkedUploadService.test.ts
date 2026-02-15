/**
 * ChunkedUploadService Tests
 *
 * Story 6.2 - Task 6.4: Resumable upload with chunking
 */

import { ChunkedUploadService } from '../ChunkedUploadService';
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

// Mock FileSystem for chunking
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

describe('ChunkedUploadService', () => {
  let service: ChunkedUploadService;
  const mockApiUrl = 'https://api.test.com';
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChunkedUploadService(mockApiUrl, CHUNK_SIZE);
  });

  describe('Constructor', () => {
    it('should initialize with API URL and chunk size', () => {
      expect(service).toBeInstanceOf(ChunkedUploadService);
    });

    it('should use default chunk size if not provided', () => {
      const defaultService = new ChunkedUploadService(mockApiUrl);
      expect(defaultService).toBeInstanceOf(ChunkedUploadService);
    });
  });

  describe('calculateChunks()', () => {
    it('should calculate number of chunks for large file', () => {
      const fileSize = 50 * 1024 * 1024; // 50MB
      const result = service.calculateChunks(fileSize);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.totalChunks).toBe(10); // 50MB / 5MB = 10 chunks
      expect(result.data?.chunkSize).toBe(CHUNK_SIZE);
    });

    it('should return 1 chunk for small file', () => {
      const fileSize = 2 * 1024 * 1024; // 2MB
      const result = service.calculateChunks(fileSize);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.totalChunks).toBe(1);
    });

    it('should validate file size', () => {
      const result = service.calculateChunks(0);

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toContain('Invalid file size');
    });
  });

  describe('uploadChunk()', () => {
    const mockUploadId = 'upload-123';
    const mockChunkData = 'base64encodedchunkdata';
    const mockChunkIndex = 2;
    const mockTotalChunks = 10;

    it('should upload single chunk with metadata', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { chunkUploaded: true, nextOffset: 3 },
        status: 200,
      });

      const result = await service.uploadChunk(
        mockUploadId,
        mockChunkData,
        mockChunkIndex,
        mockTotalChunks,
      );

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.chunkUploaded).toBe(true);

      // Verify axios called with correct chunk metadata
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/uploads/chunk'),
        expect.objectContaining({
          uploadId: mockUploadId,
          chunkIndex: mockChunkIndex,
          totalChunks: mockTotalChunks,
          chunkData: mockChunkData,
        }),
      );
    });

    it('should handle chunk upload failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Chunk upload timeout'));

      const result = await service.uploadChunk(
        mockUploadId,
        mockChunkData,
        mockChunkIndex,
        mockTotalChunks,
      );

      expect(result.type).toBe(RepositoryResultType.NETWORK_ERROR);
      expect(result.error).toContain('Chunk upload failed');
    });
  });

  describe('saveUploadProgress()', () => {
    const mockUploadId = 'upload-456';
    const mockLastChunkIndex = 5;

    it('should save last uploaded chunk index to database', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rowsAffected: 1,
      });

      const result = await service.saveUploadProgress(mockUploadId, mockLastChunkIndex);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      // Verify database update with chunk offset
      expect(database.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE upload_queue'),
        expect.arrayContaining([mockLastChunkIndex, mockUploadId]),
      );
    });

    it('should handle database errors', async () => {
      (database.execute as jest.Mock).mockImplementation(() => {
        throw new Error('Database write failed');
      });

      const result = await service.saveUploadProgress(mockUploadId, mockLastChunkIndex);

      expect(result.type).toBe(RepositoryResultType.DATABASE_ERROR);
    });
  });

  describe('getUploadProgress()', () => {
    const mockUploadId = 'upload-789';

    it('should retrieve last uploaded chunk index', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rows: [{ id: mockUploadId, last_chunk_uploaded: 3 }],
      });

      const result = await service.getUploadProgress(mockUploadId);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.lastChunkUploaded).toBe(3);

      expect(database.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockUploadId],
      );
    });

    it('should return 0 if no progress saved yet', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rows: [{ id: mockUploadId, last_chunk_uploaded: null }],
      });

      const result = await service.getUploadProgress(mockUploadId);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.lastChunkUploaded).toBe(0);
    });

    it('should return NOT_FOUND if upload does not exist', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rows: [],
      });

      const result = await service.getUploadProgress('non-existent');

      expect(result.type).toBe(RepositoryResultType.NOT_FOUND);
    });
  });

  describe('uploadFileInChunks() - Integration', () => {
    const mockUploadId = 'upload-integration';
    const mockCaptureId = 'capture-integration';
    const mockFilePath = '/audio/large.m4a';
    const mockFileSize = 15 * 1024 * 1024; // 15MB = 3 chunks

    it('should upload file in multiple chunks and track progress', async () => {
      // Mock successful chunk uploads
      mockedAxios.post.mockResolvedValue({
        data: { chunkUploaded: true },
        status: 200,
      });

      // Mock database updates
      (database.execute as jest.Mock).mockReturnValue({
        rowsAffected: 1,
      });

      const progressCallback = jest.fn();

      const result = await service.uploadFileInChunks(
        mockUploadId,
        mockCaptureId,
        mockFilePath,
        mockFileSize,
        progressCallback,
      );

      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      // Verify 3 chunks uploaded (15MB / 5MB)
      const chunkCalls = (mockedAxios.post as jest.Mock).mock.calls.filter((call) =>
        call[0].includes('/chunk'),
      );
      expect(chunkCalls.length).toBe(3);

      // Verify progress callback called
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should resume from last uploaded chunk on failure', async () => {
      // Mock database: last_chunk_uploaded = 1 (chunks 0, 1 already uploaded, resume from chunk 2)
      (database.execute as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return { rows: [{ last_chunk_uploaded: 1 }] };
        }
        return { rowsAffected: 1 };
      });

      // Mock axios: fail on chunk 2 (first call since we resume from chunk 2)
      mockedAxios.post.mockRejectedValue(new Error('Network interrupted'));

      const result = await service.uploadFileInChunks(
        mockUploadId,
        mockCaptureId,
        mockFilePath,
        mockFileSize,
      );

      expect(result.type).toBe(RepositoryResultType.NETWORK_ERROR);

      // Verify chunk 2 upload was attempted (resuming from last_chunk_uploaded = 1)
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/chunk'),
        expect.objectContaining({
          uploadId: mockUploadId,
          chunkIndex: 2, // Resume from chunk 2
          totalChunks: 3,
        }),
      );
    });

    it('should validate resumable upload on retry', async () => {
      // Simulate resume scenario: chunks 0-1 already uploaded
      (database.execute as jest.Mock).mockReturnValue({
        rows: [{ id: mockUploadId, last_chunk_uploaded: 1 }],
      });

      mockedAxios.post.mockResolvedValue({
        data: { chunkUploaded: true },
        status: 200,
      });

      // Call resume
      const result = await service.resumeUpload(mockUploadId, mockCaptureId, mockFilePath, mockFileSize);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      // Verify only chunk 2 uploaded (resume from index 2, skip 0-1)
      const chunkCalls = (mockedAxios.post as jest.Mock).mock.calls.filter((call) =>
        call[0].includes('/chunk'),
      );
      expect(chunkCalls.length).toBe(1); // Only last chunk uploaded
    });
  });
});
