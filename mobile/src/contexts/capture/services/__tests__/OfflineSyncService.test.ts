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

// Mock CaptureRepository
jest.mock('../../data/CaptureRepository');

describe('OfflineSyncService', () => {
  let service: OfflineSyncService;
  let mockRepository: jest.Mocked<CaptureRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      findBySyncStatus: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
    } as any;

    service = new OfflineSyncService(mockRepository);
  });

  describe('getPendingCaptures', () => {
    it('should return all captures with pending sync status', async () => {
      const pendingCaptures = [
        {
          id: 'capture-1',
          _raw: {
            type: 'audio',
            state: 'captured',
            raw_content: '/audio1.m4a',
            captured_at: 1234567890000,
            sync_status: 'pending',
          },
        },
        {
          id: 'capture-2',
          _raw: {
            type: 'audio',
            state: 'captured',
            raw_content: '/audio2.m4a',
            captured_at: 1234567891000,
            sync_status: 'pending',
          },
        },
      ];

      mockRepository.findBySyncStatus.mockResolvedValue(pendingCaptures);

      const result = await service.getPendingCaptures();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'capture-1',
        type: 'audio',
        state: 'captured',
        rawContent: '/audio1.m4a',
        capturedAt: new Date(1234567890000),
      });
      expect(mockRepository.findBySyncStatus).toHaveBeenCalledWith('pending');
    });

    it('should return empty array when no pending captures exist', async () => {
      mockRepository.findBySyncStatus.mockResolvedValue([]);

      const result = await service.getPendingCaptures();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockRepository.findBySyncStatus.mockRejectedValue(new Error('DB error'));

      const result = await service.getPendingCaptures();

      expect(result).toEqual([]);
    });
  });

  describe('markAsSynced', () => {
    it('should update capture sync status to synced', async () => {
      mockRepository.update.mockResolvedValue({} as any);

      await service.markAsSynced('capture-123');

      expect(mockRepository.update).toHaveBeenCalledWith('capture-123', {
        syncStatus: 'synced',
      });
    });

    it('should throw error if update fails', async () => {
      mockRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.markAsSynced('capture-123')).rejects.toThrow('Update failed');
    });
  });

  describe('markAsPending', () => {
    it('should update capture sync status to pending', async () => {
      mockRepository.update.mockResolvedValue({} as any);

      await service.markAsPending('capture-456');

      expect(mockRepository.update).toHaveBeenCalledWith('capture-456', {
        syncStatus: 'pending',
      });
    });

    it('should throw error if update fails', async () => {
      mockRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.markAsPending('capture-456')).rejects.toThrow('Update failed');
    });
  });

  describe('getSyncStats', () => {
    it('should return correct sync statistics', async () => {
      const allCaptures = [
        { id: '1', _raw: { sync_status: 'pending' } },
        { id: '2', _raw: { sync_status: 'pending' } },
        { id: '3', _raw: { sync_status: 'synced' } },
      ];

      const pendingCaptures = [
        { id: '1', _raw: { sync_status: 'pending' } },
        { id: '2', _raw: { sync_status: 'pending' } },
      ];

      const syncedCaptures = [{ id: '3', _raw: { sync_status: 'synced' } }];

      mockRepository.findAll.mockResolvedValue(allCaptures);
      mockRepository.findBySyncStatus
        .mockResolvedValueOnce(pendingCaptures) // First call for pending
        .mockResolvedValueOnce(syncedCaptures); // Second call for synced

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
          _raw: {
            type: 'audio',
            state: 'captured',
            raw_content: '/audio1.m4a',
            captured_at: 1234567890000,
            sync_status: 'pending',
          },
        },
        {
          id: 'capture-2',
          _raw: {
            type: 'audio',
            state: 'recording', // Should be filtered out
            raw_content: '/audio2.m4a',
            captured_at: 1234567891000,
            sync_status: 'pending',
          },
        },
        {
          id: 'capture-3',
          _raw: {
            type: 'audio',
            state: 'ready',
            raw_content: '/audio3.m4a',
            captured_at: 1234567892000,
            sync_status: 'pending',
          },
        },
        {
          id: 'capture-4',
          _raw: {
            type: 'audio',
            state: 'failed', // Should be filtered out
            raw_content: '/audio4.m4a',
            captured_at: 1234567893000,
            sync_status: 'pending',
          },
        },
      ];

      mockRepository.findBySyncStatus.mockResolvedValue(pendingCaptures);

      const result = await service.getReadyForSync();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('capture-1');
      expect(result[1].id).toBe('capture-3');
    });

    it('should return empty array when no ready captures exist', async () => {
      mockRepository.findBySyncStatus.mockResolvedValue([]);

      const result = await service.getReadyForSync();

      expect(result).toEqual([]);
    });
  });

  describe('hasPendingSync', () => {
    it('should return true when pending captures exist', async () => {
      mockRepository.findBySyncStatus.mockResolvedValue([
        { id: '1', _raw: { sync_status: 'pending' } },
      ]);

      const result = await service.hasPendingSync();

      expect(result).toBe(true);
    });

    it('should return false when no pending captures exist', async () => {
      mockRepository.findBySyncStatus.mockResolvedValue([]);

      const result = await service.hasPendingSync();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRepository.findBySyncStatus.mockRejectedValue(new Error('DB error'));

      const result = await service.hasPendingSync();

      expect(result).toBe(false);
    });
  });
});
