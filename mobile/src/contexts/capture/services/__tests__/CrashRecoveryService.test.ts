/**
 * Tests for Crash Recovery Service
 *
 * AC4: Crash Recovery
 * - Detect incomplete recordings on app launch
 * - Attempt recovery of partial audio files
 * - Store recovery metadata in WatermelonDB
 * - Notify user of recovered captures
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { CrashRecoveryService } from '../CrashRecoveryService';
import { CaptureRepository } from '../../data/CaptureRepository';
import { RepositoryResultType } from '../../domain/Result';

// Mock CaptureRepository
jest.mock('../../data/CaptureRepository');

describe('CrashRecoveryService', () => {
  let service: CrashRecoveryService;
  let mockRepository: jest.Mocked<CaptureRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      findByState: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    service = new CrashRecoveryService(mockRepository);
  });

  describe('recoverIncompleteRecordings', () => {
    it('should return empty array when no incomplete recordings exist', async () => {
      mockRepository.findByState.mockResolvedValue([]);

      const results = await service.recoverIncompleteRecordings();

      expect(results).toEqual([]);
      expect(mockRepository.findByState).toHaveBeenCalledWith('recording');
    });

    it('should recover captures with valid audio files', async () => {
      const incompleteCapture = {
        id: 'capture-123',
        type: 'audio',
        state: 'recording',
        rawContent: '/path/to/audio.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      };

      mockRepository.findByState.mockResolvedValue([incompleteCapture]);
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { ...incompleteCapture, state: 'captured' } as any,
      });

      const results = await service.recoverIncompleteRecordings();

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        captureId: 'capture-123',
        state: 'recovered',
      });

      // Verify capture was updated to "captured" state
      expect(mockRepository.update).toHaveBeenCalledWith('capture-123', {
        state: 'captured',
        syncStatus: 'pending',
      });
    });

    it('should mark captures as failed when audio file does not exist', async () => {
      const incompleteCapture = {
        id: 'capture-456',
        type: 'audio',
        state: 'recording',
        rawContent: '', // Empty path = file doesn't exist
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      };

      mockRepository.findByState.mockResolvedValue([incompleteCapture]);
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { ...incompleteCapture, state: 'failed' } as any,
      });

      const results = await service.recoverIncompleteRecordings();

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        captureId: 'capture-456',
        state: 'failed',
        reason: 'Audio file not found',
      });

      // Verify capture was updated to "failed" state
      expect(mockRepository.update).toHaveBeenCalledWith('capture-456', {
        state: 'failed',
        syncStatus: 'pending',
      });
    });

    it('should recover multiple incomplete captures', async () => {
      const incompleteCaptures = [
        {
          id: 'capture-1',
          type: 'audio',
          state: 'recording',
          rawContent: '/path/1.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
        {
          id: 'capture-2',
          type: 'audio',
          state: 'recording',
          rawContent: '/path/2.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
        {
          id: 'capture-3',
          type: 'audio',
          state: 'recording',
          rawContent: '', // Will fail
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      ];

      mockRepository.findByState.mockResolvedValue(incompleteCaptures);
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {} as any,
      });

      const results = await service.recoverIncompleteRecordings();

      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.state === 'recovered')).toHaveLength(2);
      expect(results.filter((r) => r.state === 'failed')).toHaveLength(1);
    });

    it('should handle recovery errors gracefully', async () => {
      const incompleteCapture = {
        id: 'capture-error',
        type: 'audio',
        state: 'recording',
        rawContent: '/path/error.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      };

      mockRepository.findByState.mockResolvedValue([incompleteCapture]);
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.DATABASE_ERROR,
        error: 'Database error',
      });

      const results = await service.recoverIncompleteRecordings();

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        captureId: 'capture-error',
        state: 'failed',
        reason: 'Database error',
      });
    });
  });

  describe('getPendingRecoveryCount', () => {
    it('should return count of incomplete recordings', async () => {
      const incompleteCaptures = [
        { id: '1', type: 'audio', state: 'recording', rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date(), syncStatus: 'pending' },
        { id: '2', type: 'audio', state: 'recording', rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date(), syncStatus: 'pending' },
      ];

      mockRepository.findByState.mockResolvedValue(incompleteCaptures);

      const count = await service.getPendingRecoveryCount();

      expect(count).toBe(2);
      expect(mockRepository.findByState).toHaveBeenCalledWith('recording');
    });

    it('should return 0 when no incomplete recordings exist', async () => {
      mockRepository.findByState.mockResolvedValue([]);

      const count = await service.getPendingRecoveryCount();

      expect(count).toBe(0);
    });
  });

  describe('clearFailedCaptures', () => {
    it('should delete all failed captures', async () => {
      const failedCaptures = [
        { id: 'failed-1', type: 'audio', state: 'failed', rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date(), syncStatus: 'pending' },
        { id: 'failed-2', type: 'audio', state: 'failed', rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date(), syncStatus: 'pending' },
      ];

      mockRepository.findByState.mockResolvedValue(failedCaptures);
      mockRepository.delete.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: undefined,
      });

      const deletedCount = await service.clearFailedCaptures();

      expect(deletedCount).toBe(2);
      expect(mockRepository.delete).toHaveBeenCalledTimes(2);
      expect(mockRepository.delete).toHaveBeenCalledWith('failed-1');
      expect(mockRepository.delete).toHaveBeenCalledWith('failed-2');
    });

    it('should return 0 when no failed captures exist', async () => {
      mockRepository.findByState.mockResolvedValue([]);

      const deletedCount = await service.clearFailedCaptures();

      expect(deletedCount).toBe(0);
    });

    it('should handle deletion errors gracefully', async () => {
      const failedCaptures = [
        { id: 'failed-1', type: 'audio', state: 'failed', rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date(), syncStatus: 'pending' },
        { id: 'failed-2', type: 'audio', state: 'failed', rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date(), syncStatus: 'pending' },
      ];

      mockRepository.findByState.mockResolvedValue(failedCaptures);
      mockRepository.delete
        .mockResolvedValueOnce({
          type: RepositoryResultType.SUCCESS,
          data: undefined,
        }) // First delete succeeds
        .mockResolvedValueOnce({
          type: RepositoryResultType.DATABASE_ERROR,
          error: 'Delete failed',
        }); // Second fails

      const deletedCount = await service.clearFailedCaptures();

      expect(deletedCount).toBe(1); // Only first one deleted
    });
  });
});
