/**
 * Tests for StorageMonitorService
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC2: Handle Multiple Successive Offline Captures
 * Task 4: Implement Storage Space Monitoring
 */

import { StorageMonitorService } from '../StorageMonitorService';
import { database } from '../../../../database';
import { StorageVolume } from 'expo-file-system';

// Mock database
jest.mock('../../../../database', () => ({
  database: {
    execute: jest.fn(),
  },
}));

describe('StorageMonitorService', () => {
  let service: StorageMonitorService;
  let mockDatabase: jest.Mocked<typeof database>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = database as jest.Mocked<typeof database>;
    service = new StorageMonitorService();
  });

  describe('getStorageInfo', () => {
    it('should return storage information with free space', async () => {
      // Mock 500MB free space
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(500 * 1024 * 1024);

      // Mock 100MB used by captures
      mockDatabase.execute.mockReturnValueOnce({
        rows: [
          { file_size: 50 * 1024 * 1024 },
          { file_size: 50 * 1024 * 1024 },
        ],
      } as any);

      const info = await service.getStorageInfo();

      expect(info.freeBytes).toBe(500 * 1024 * 1024);
      expect(info.usedBytes).toBe(100 * 1024 * 1024);
      expect(info.totalBytes).toBe(600 * 1024 * 1024);
      expect(info.freePercentage).toBeCloseTo(83.33, 1);
      expect(info.isCriticallyLow).toBe(false);
      expect(info.freeFormatted).toBe('500.0 MB');
    });

    it('should mark storage as critically low when < 100MB', async () => {
      // Mock 50MB free space (below 100MB threshold)
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(50 * 1024 * 1024);
      mockDatabase.execute.mockReturnValueOnce({ rows: [] } as any);

      const info = await service.getStorageInfo();

      expect(info.isCriticallyLow).toBe(true);
      expect(info.freeBytes).toBe(50 * 1024 * 1024);
    });

    it('should return safe defaults on error', async () => {
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockRejectedValue(
        new Error('Filesystem error')
      );

      const info = await service.getStorageInfo();

      // Returns safe defaults
      expect(info.totalBytes).toBe(0);
      expect(info.freeBytes).toBe(0);
      expect(info.usedBytes).toBe(0);
      expect(info.isCriticallyLow).toBe(true); // Assume critical for safety
    });
  });

  describe('isStorageCriticallyLow', () => {
    it('should return false when storage is sufficient', async () => {
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(200 * 1024 * 1024);

      const isCritical = await service.isStorageCriticallyLow();

      expect(isCritical).toBe(false);
    });

    it('should return true when storage is below threshold', async () => {
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(50 * 1024 * 1024);

      const isCritical = await service.isStorageCriticallyLow();

      expect(isCritical).toBe(true);
    });

    it('should return true on error for safety', async () => {
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockRejectedValue(new Error('Error'));

      const isCritical = await service.isStorageCriticallyLow();

      expect(isCritical).toBe(true);
    });
  });

  describe('getCaptureStorageStats', () => {
    it('should calculate total size of all capture files', async () => {
      mockDatabase.execute.mockReturnValueOnce({
        rows: [
          { file_size: 10 * 1024 * 1024 }, // 10MB
          { file_size: 20 * 1024 * 1024 }, // 20MB
          { file_size: 15 * 1024 * 1024 }, // 15MB
        ],
      } as any);

      const stats = await service.getCaptureStorageStats();

      expect(stats.totalBytes).toBe(45 * 1024 * 1024);
      expect(stats.fileCount).toBe(3);
      expect(stats.averageBytes).toBe(15 * 1024 * 1024);
      expect(stats.totalFormatted).toBe('45.0 MB');
    });

    it('should handle null file sizes', async () => {
      mockDatabase.execute.mockReturnValueOnce({
        rows: [{ file_size: 10 * 1024 * 1024 }, { file_size: null }, { file_size: 5 * 1024 * 1024 }],
      } as any);

      const stats = await service.getCaptureStorageStats();

      expect(stats.totalBytes).toBe(15 * 1024 * 1024);
      expect(stats.fileCount).toBe(2); // Only counts non-null sizes
    });

    it('should return zeros when no captures exist', async () => {
      mockDatabase.execute.mockReturnValueOnce({ rows: [] } as any);

      const stats = await service.getCaptureStorageStats();

      expect(stats.totalBytes).toBe(0);
      expect(stats.fileCount).toBe(0);
      expect(stats.averageBytes).toBe(0);
      expect(stats.totalFormatted).toBe('0 B');
    });

    it('should return zeros on error', async () => {
      mockDatabase.execute.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const stats = await service.getCaptureStorageStats();

      expect(stats.totalBytes).toBe(0);
    });
  });

  describe('hasSufficientStorage', () => {
    it('should return true when sufficient space for estimated duration', async () => {
      // 200MB free, need ~15MB for 3 minutes (5MB/min * 3)
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(200 * 1024 * 1024);

      const hasSufficient = await service.hasSufficientStorage(3); // 3 minutes

      expect(hasSufficient).toBe(true);
    });

    it('should return false when insufficient space', async () => {
      // 50MB free, need ~125MB for 5 minutes (5MB/min * 5 + 100MB buffer)
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(50 * 1024 * 1024);

      const hasSufficient = await service.hasSufficientStorage(5);

      expect(hasSufficient).toBe(false);
    });

    it('should include critical threshold buffer in calculation', async () => {
      // 105MB free, need 5MB for 1 minute + 100MB buffer = 105MB
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(105 * 1024 * 1024);

      const hasSufficient = await service.hasSufficientStorage(1);

      expect(hasSufficient).toBe(true);
    });

    it('should return false on error for safety', async () => {
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockRejectedValue(new Error('Error'));

      const hasSufficient = await service.hasSufficientStorage(5);

      expect(hasSufficient).toBe(false);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(service.formatBytes(0)).toBe('0 B');
      expect(service.formatBytes(1023)).toBe('1023 B');
      expect(service.formatBytes(1024)).toBe('1.0 KB');
      expect(service.formatBytes(1536)).toBe('1.5 KB');
      expect(service.formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(service.formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
      expect(service.formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should handle large numbers', () => {
      expect(service.formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
    });
  });

  describe('setCriticalThreshold', () => {
    it('should update critical threshold', async () => {
      service.setCriticalThreshold(200 * 1024 * 1024); // 200MB

      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(150 * 1024 * 1024);

      const isCritical = await service.isStorageCriticallyLow();

      expect(isCritical).toBe(true); // 150MB < 200MB threshold
    });

    it('should reject negative thresholds', () => {
      service.setCriticalThreshold(-100);

      const threshold = service.getCriticalThreshold();

      expect(threshold).toBe(100 * 1024 * 1024); // Reverts to default
    });
  });

  describe('getCriticalThreshold', () => {
    it('should return default threshold', () => {
      const threshold = service.getCriticalThreshold();

      expect(threshold).toBe(100 * 1024 * 1024); // 100MB default
    });

    it('should return updated threshold', () => {
      service.setCriticalThreshold(50 * 1024 * 1024);

      const threshold = service.getCriticalThreshold();

      expect(threshold).toBe(50 * 1024 * 1024);
    });
  });

  describe('NFR6: Zero Data Loss - Storage Overflow Prevention', () => {
    it('should warn before storage critically low', async () => {
      // 110MB free - just above threshold
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(110 * 1024 * 1024);

      const isCritical = await service.isStorageCriticallyLow();

      expect(isCritical).toBe(false);

      // 90MB free - below threshold
      (StorageVolume.getAvailableSpaceAsync as jest.Mock).mockResolvedValue(90 * 1024 * 1024);

      const isCritical2 = await service.isStorageCriticallyLow();

      expect(isCritical2).toBe(true);
    });
  });
});
