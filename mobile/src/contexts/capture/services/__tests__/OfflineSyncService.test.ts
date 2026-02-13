/**
 * Tests for Offline Sync Service
 *
 * AC3: Offline Functionality
 * - Mark Capture entities for future sync
 * - Implement offline queue for pending captures
 * - Ensure WatermelonDB sync protocol compatibility
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { OfflineSyncService } from '../OfflineSyncService';
import { CaptureRepository } from '../../data/CaptureRepository';
import { SyncQueueService } from '../SyncQueueService';

// Mock dependencies
jest.mock('../../data/CaptureRepository');
jest.mock('../SyncQueueService');

describe('OfflineSyncService', () => {
  let service: OfflineSyncService;
  let mockRepository: jest.Mocked<CaptureRepository>;
  let mockSyncQueueService: jest.Mocked<SyncQueueService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      findPendingSync: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findSynced: jest.fn(),
      update: jest.fn(),
    } as any;

    mockSyncQueueService = {
      getPendingOperationsForEntity: jest.fn(),
      markAsSynced: jest.fn(),
      enqueue: jest.fn(),
    } as any;

    service = new OfflineSyncService(mockRepository, mockSyncQueueService);
  });

  describe('getPendingCaptures', () => {
    it('should return all captures with pending sync status', async () => {
      const pendingCaptures = [
        {
          id: 'capture-1',
          type: CAPTURE_TYPES.AUDIO,
          state: CAPTURE_STATES.CAPTURED,
          rawContent: '/audio1.m4a',
          createdAt: new Date(1234567890000),
          updatedAt: new Date(1234567890000),
          capturedAt: new Date(1234567890000),
        },
        {
          id: 'capture-2',
          type: CAPTURE_TYPES.AUDIO,
          state: CAPTURE_STATES.CAPTURED,
          rawContent: '/audio2.m4a',
          createdAt: new Date(1234567891000),
          updatedAt: new Date(1234567891000),
          capturedAt: new Date(1234567891000),
        },
      ];

      mockRepository.findPendingSync.mockResolvedValue(pendingCaptures);

      const result = await service.getPendingCaptures();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'capture-1',
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/audio1.m4a',
        capturedAt: new Date(1234567890000),
      });
      expect(mockRepository.findPendingSync).toHaveBeenCalled();
    });

    it('should return empty array when no pending captures exist', async () => {
      mockRepository.findPendingSync.mockResolvedValue([]);

      const result = await service.getPendingCaptures();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockRepository.findPendingSync.mockRejectedValue(new Error('DB error'));

      const result = await service.getPendingCaptures();

      expect(result).toEqual([]);
    });
  });

  describe('markAsSynced', () => {
    it('should remove capture from sync queue', async () => {
      const queueItems = [
        { id: 'queue-1', entityType: 'capture', entityId: 'capture-123' },
        { id: 'queue-2', entityType: 'capture', entityId: 'capture-123' },
      ];
      mockSyncQueueService.getPendingOperationsForEntity.mockResolvedValue(queueItems);
      mockSyncQueueService.markAsSynced.mockResolvedValue();

      await service.markAsSynced('capture-123');

      expect(mockSyncQueueService.getPendingOperationsForEntity).toHaveBeenCalledWith('capture', 'capture-123');
      expect(mockSyncQueueService.markAsSynced).toHaveBeenCalledTimes(2);
      expect(mockSyncQueueService.markAsSynced).toHaveBeenCalledWith('queue-1');
      expect(mockSyncQueueService.markAsSynced).toHaveBeenCalledWith('queue-2');
    });

    it('should handle errors gracefully', async () => {
      mockSyncQueueService.getPendingOperationsForEntity.mockRejectedValue(new Error('Queue error'));

      await expect(service.markAsSynced('capture-123')).resolves.not.toThrow();
    });
  });

  describe('markAsPending', () => {
    it('should add capture to sync queue', async () => {
      const capture = {
        id: 'capture-456',
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/path/audio.m4a',
        duration: 5000,
        fileSize: 1024000,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
      };
      mockRepository.findById.mockResolvedValue(capture);
      mockSyncQueueService.enqueue.mockResolvedValue();

      await service.markAsPending('capture-456');

      expect(mockRepository.findById).toHaveBeenCalledWith('capture-456');
      expect(mockSyncQueueService.enqueue).toHaveBeenCalledWith(
        'capture',
        'capture-456',
        'update',
        expect.objectContaining({
          type: CAPTURE_TYPES.AUDIO,
          state: CAPTURE_STATES.CAPTURED,
          rawContent: '/path/audio.m4a',
        })
      );
    });

    it('should handle capture not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.markAsPending('capture-456')).resolves.not.toThrow();
      expect(mockSyncQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('getSyncStats', () => {
    it('should return correct sync statistics', async () => {
      const allCaptures = [
        { id: '1', type: CAPTURE_TYPES.AUDIO, state: CAPTURE_STATES.CAPTURED, rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
        { id: '2', type: CAPTURE_TYPES.AUDIO, state: CAPTURE_STATES.CAPTURED, rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
        { id: '3', type: CAPTURE_TYPES.AUDIO, state: CAPTURE_STATES.CAPTURED, rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
      ];

      const pendingCaptures = [
        { id: '1', type: CAPTURE_TYPES.AUDIO, state: CAPTURE_STATES.CAPTURED, rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
        { id: '2', type: CAPTURE_TYPES.AUDIO, state: CAPTURE_STATES.CAPTURED, rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
      ];

      const syncedCaptures = [
        { id: '3', type: CAPTURE_TYPES.AUDIO, state: CAPTURE_STATES.CAPTURED, rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
      ];

      mockRepository.findAll.mockResolvedValue(allCaptures);
      mockRepository.findPendingSync.mockResolvedValue(pendingCaptures);
      mockRepository.findSynced.mockResolvedValue(syncedCaptures);

      const stats = await service.getSyncStats();

      expect(stats).toEqual({
        pendingCount: 2,
        syncedCount: 1,
        totalCount: 3,
      });
    });

    it('should handle errors gracefully', async () => {
      mockRepository.findAll.mockRejectedValue(new Error('DB error'));

      const stats = await service.getSyncStats();

      expect(stats).toEqual({
        pendingCount: 0,
        syncedCount: 0,
        totalCount: 0,
      });
    });
  });

  describe('getReadyForSync', () => {
    it('should return only captured/ready captures with pending sync', async () => {
      const pendingCaptures = [
        {
          id: 'capture-1',
          type: CAPTURE_TYPES.AUDIO,
          state: CAPTURE_STATES.CAPTURED,
          rawContent: '/audio1.m4a',
          createdAt: new Date(1234567890000),
          updatedAt: new Date(1234567890000),
          capturedAt: new Date(1234567890000),
        },
        {
          id: 'capture-2',
          type: CAPTURE_TYPES.AUDIO,
          state: CAPTURE_STATES.RECORDING, // Should be filtered out
          rawContent: '/audio2.m4a',
          createdAt: new Date(1234567891000),
          updatedAt: new Date(1234567891000),
          capturedAt: new Date(1234567891000),
        },
        {
          id: 'capture-3',
          type: CAPTURE_TYPES.AUDIO,
          state: CAPTURE_STATES.READY,
          rawContent: '/audio3.m4a',
          createdAt: new Date(1234567892000),
          updatedAt: new Date(1234567892000),
          capturedAt: new Date(1234567892000),
        },
        {
          id: 'capture-4',
          type: CAPTURE_TYPES.AUDIO,
          state: CAPTURE_STATES.FAILED, // Should be filtered out
          rawContent: '/audio4.m4a',
          createdAt: new Date(1234567893000),
          updatedAt: new Date(1234567893000),
          capturedAt: new Date(1234567893000),
        },
      ];

      mockRepository.findPendingSync.mockResolvedValue(pendingCaptures);

      const result = await service.getReadyForSync();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('capture-1');
      expect(result[1].id).toBe('capture-3');
    });

    it('should return empty array when no ready captures exist', async () => {
      mockRepository.findPendingSync.mockResolvedValue([]);

      const result = await service.getReadyForSync();

      expect(result).toEqual([]);
    });
  });

  describe('hasPendingSync', () => {
    it('should return true when pending captures exist', async () => {
      mockRepository.findPendingSync.mockResolvedValue([
        { id: '1', type: CAPTURE_TYPES.AUDIO, state: CAPTURE_STATES.CAPTURED, rawContent: '', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date(), syncStatus: 'pending' },
      ]);

      const result = await service.hasPendingSync();

      expect(result).toBe(true);
    });

    it('should return false when no pending captures exist', async () => {
      mockRepository.findPendingSync.mockResolvedValue([]);

      const result = await service.hasPendingSync();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRepository.findPendingSync.mockRejectedValue(new Error('DB error'));

      const result = await service.hasPendingSync();

      expect(result).toBe(false);
    });
  });
});
