/**
 * Tests for RetentionPolicyService
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC5: Storage Management with Retention Policy
 * Task 6: Implement Storage Retention Policy
 */

import { RetentionPolicyService } from '../RetentionPolicyService';
import { CaptureRepository } from '../../data/CaptureRepository';
import { RepositoryResultType } from '../../domain/Result';
import { MockFileSystem } from '../../__tests__/helpers/MockFileSystem';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('../../data/CaptureRepository');
jest.mock('@react-native-async-storage/async-storage');

describe('RetentionPolicyService', () => {
  let service: RetentionPolicyService;
  let mockRepository: jest.Mocked<CaptureRepository>;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      findSynced: jest.fn(),
      update: jest.fn(),
    } as any;

    mockFileSystem = new MockFileSystem();

    // Mock AsyncStorage.getItem to return null (no saved config)
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    service = new RetentionPolicyService(mockRepository, mockFileSystem);
  });

  describe('getRetentionConfig', () => {
    it('should return default configuration', () => {
      const config = service.getRetentionConfig();

      expect(config).toEqual({
        audioRetentionDays: 30,
        autoCleanupEnabled: true,
        notifyBeforeCleanup: true,
      });
    });
  });

  describe('setRetentionConfig', () => {
    it('should update retention configuration', () => {
      service.setRetentionConfig({
        audioRetentionDays: 60,
        autoCleanupEnabled: false,
      });

      const config = service.getRetentionConfig();

      expect(config.audioRetentionDays).toBe(60);
      expect(config.autoCleanupEnabled).toBe(false);
      expect(config.notifyBeforeCleanup).toBe(true); // Unchanged
    });

    it('should persist configuration to AsyncStorage', () => {
      service.setRetentionConfig({ audioRetentionDays: 45 });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pensieve_retention_config',
        expect.stringContaining('"audioRetentionDays":45')
      );
    });
  });

  describe('previewCleanup', () => {
    it('should return empty preview when no eligible files', async () => {
      mockRepository.findSynced.mockResolvedValue([]);

      const preview = await service.previewCleanup();

      expect(preview.eligibleFiles).toBe(0);
      expect(preview.totalBytesFreeable).toBe(0);
      expect(preview.oldestFileDate).toBeNull();
      expect(preview.newestFileDate).toBeNull();
      expect(preview.candidates).toEqual([]);
    });

    it('should identify files older than retention period', async () => {
      // Create captures older than 30 days
      const now = new Date();
      const old1 = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
      const old2 = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago

      const oldCaptures = [
        {
          id: 'cap-1',
          type: 'audio',
          state: 'captured',
          rawContent: '/path/to/audio1.m4a',
          fileSize: 10 * 1024 * 1024, // 10MB
          capturedAt: old1,
          syncStatus: 'synced',
          createdAt: old1,
          updatedAt: old1,
        },
        {
          id: 'cap-2',
          type: 'audio',
          state: 'captured',
          rawContent: '/path/to/audio2.m4a',
          fileSize: 15 * 1024 * 1024, // 15MB
          capturedAt: old2,
          syncStatus: 'synced',
          createdAt: old2,
          updatedAt: old2,
        },
      ];

      mockRepository.findSynced.mockResolvedValue(oldCaptures as any);

      const preview = await service.previewCleanup();

      expect(preview.eligibleFiles).toBe(2);
      expect(preview.totalBytesFreeable).toBe(25 * 1024 * 1024); // 25MB
      expect(preview.oldestFileDate).toEqual(old2);
      expect(preview.newestFileDate).toEqual(old1);
      expect(preview.candidates).toHaveLength(2);
    });

    it('should not include recent files', async () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const recentCaptures = [
        {
          id: 'cap-recent',
          type: 'audio',
          state: 'captured',
          rawContent: '/path/to/recent.m4a',
          fileSize: 5 * 1024 * 1024,
          capturedAt: recent,
          syncStatus: 'synced',
          createdAt: recent,
          updatedAt: recent,
        },
      ];

      mockRepository.findSynced.mockResolvedValue(recentCaptures as any);

      const preview = await service.previewCleanup();

      expect(preview.eligibleFiles).toBe(0); // Not old enough
    });

    it('should never include pending syncs', async () => {
      const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      // findBySyncStatus('synced') won't return pending captures
      // So mock returns empty array when querying for 'synced'
      mockRepository.findSynced.mockResolvedValue([]);

      const preview = await service.previewCleanup();

      // Verify it queried only for synced captures
      expect(mockRepository.findSynced).toHaveBeenCalled();
      // No eligible files because pending syncs are never included
      expect(preview.eligibleFiles).toBe(0);
    });
  });

  describe('executeCleanup', () => {
    it('should delete audio files and update database records', async () => {
      const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      const oldCaptures = [
        {
          id: 'cap-1',
          type: 'audio',
          state: 'captured',
          rawContent: '/path/to/audio1.m4a',
          fileSize: 10 * 1024 * 1024,
          capturedAt: old,
          syncStatus: 'synced',
          createdAt: old,
          updatedAt: old,
        },
      ];

      mockRepository.findSynced.mockResolvedValue(oldCaptures as any);
      // FileSystem now injected via IFileSystem - no need to mock
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {} as any,
      });

      const result = await service.executeCleanup();

      expect(result.filesDeleted).toBe(1);
      expect(result.bytesFreed).toBe(10 * 1024 * 1024);
      expect(result.failures).toBe(0);
      expect(result.deletedCaptureIds).toEqual(['cap-1']);

      // Verify file deleted
      expect(mockFileSystem.deleteFileSpy).toHaveBeenCalledWith('/path/to/audio1.m4a');

      // Verify DB updated to clear audio file
      expect(mockRepository.update).toHaveBeenCalledWith('cap-1', {
        rawContent: '',
        fileSize: null,
      });
    });

    it('should preserve metadata and transcriptions', async () => {
      const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      mockRepository.findSynced.mockResolvedValue([
        {
          id: 'cap-1',
          type: 'audio',
          rawContent: '/path/to/audio.m4a',
          fileSize: 5 * 1024 * 1024,
          capturedAt: old,
          syncStatus: 'synced',
          // Metadata fields that should be preserved
          transcription: 'This is a transcription',
          todos: ['Todo 1', 'Todo 2'],
          createdAt: old,
          updatedAt: old,
          state: 'captured',
        },
      ] as any);

      // FileSystem now injected via IFileSystem - no need to mock
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {} as any,
      });

      await service.executeCleanup();

      // Verify update only clears rawContent and fileSize
      expect(mockRepository.update).toHaveBeenCalledWith('cap-1', {
        rawContent: '',
        fileSize: null,
      });

      // Transcription and todos NOT passed to update = preserved
    });

    it('should handle file deletion failures gracefully', async () => {
      const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      mockRepository.findSynced.mockResolvedValue([
        {
          id: 'cap-1',
          rawContent: '/path/to/audio.m4a',
          fileSize: 5 * 1024 * 1024,
          capturedAt: old,
          syncStatus: 'synced',
          createdAt: old,
          updatedAt: old,
          type: 'audio',
          state: 'captured',
        },
      ] as any);

      // Mock file deletion failure
      mockFileSystem.deleteFile = jest.fn().mockResolvedValue({
        type: RepositoryResultType.DATABASE_ERROR,
        error: 'File not found',
      });

      const result = await service.executeCleanup();

      expect(result.filesDeleted).toBe(0);
      expect(result.failures).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to delete file');
    });

    it('should handle database update failures gracefully', async () => {
      const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      mockRepository.findSynced.mockResolvedValue([
        {
          id: 'cap-1',
          rawContent: '/path/to/audio.m4a',
          fileSize: 5 * 1024 * 1024,
          capturedAt: old,
          syncStatus: 'synced',
          createdAt: old,
          updatedAt: old,
          type: 'audio',
          state: 'captured',
        },
      ] as any);

      // FileSystem now injected via IFileSystem - no need to mock
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.ERROR,
        error: 'Database error',
      });

      const result = await service.executeCleanup();

      expect(result.filesDeleted).toBe(0);
      expect(result.failures).toBe(1);
      expect(result.errors[0]).toContain('Failed to update DB');
    });

    it('should update last cleanup date after execution', async () => {
      mockRepository.findSynced.mockResolvedValue([]);

      await service.executeCleanup();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pensieve_last_cleanup_date',
        expect.any(String)
      );
    });
  });

  describe('shouldRunCleanup', () => {
    it('should return false when autoCleanup disabled', async () => {
      service.setRetentionConfig({ autoCleanupEnabled: false });

      const shouldRun = await service.shouldRunCleanup();

      expect(shouldRun).toBe(false);
    });

    it('should return false when no eligible files', async () => {
      mockRepository.findSynced.mockResolvedValue([]);

      const shouldRun = await service.shouldRunCleanup();

      expect(shouldRun).toBe(false);
    });

    it('should return true when eligible files exist', async () => {
      const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      mockRepository.findSynced.mockResolvedValue([
        {
          id: 'cap-1',
          rawContent: '/path/to/audio.m4a',
          fileSize: 5 * 1024 * 1024,
          capturedAt: old,
          syncStatus: 'synced',
          createdAt: old,
          updatedAt: old,
          type: 'audio',
          state: 'captured',
        },
      ] as any);

      const shouldRun = await service.shouldRunCleanup();

      expect(shouldRun).toBe(true);
    });
  });

  describe('getLastCleanupDate / setLastCleanupDate', () => {
    it('should return null when never run', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const date = await service.getLastCleanupDate();

      expect(date).toBeNull();
    });

    it('should persist and retrieve last cleanup date', async () => {
      const now = new Date();
      await service.setLastCleanupDate(now);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pensieve_last_cleanup_date',
        now.toISOString()
      );

      // Simulate retrieval
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(now.toISOString());

      const retrieved = await service.getLastCleanupDate();

      expect(retrieved?.toISOString()).toBe(now.toISOString());
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(service.formatBytes(0)).toBe('0 B');
      expect(service.formatBytes(1024)).toBe('1.0 KB');
      expect(service.formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(service.formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });
  });

  describe('NFR6: Zero Data Loss - Never Delete Pending Syncs', () => {
    it('should never delete audio files with pending sync status', async () => {
      const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days old

      // Service only queries synced captures
      mockRepository.findSynced.mockResolvedValue([]);

      const result = await service.executeCleanup();

      // Verify findSynced called (no params)
      expect(mockRepository.findSynced).toHaveBeenCalled();
      expect(result.filesDeleted).toBe(0);
    });

    it('should always preserve transcriptions and metadata', async () => {
      const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      mockRepository.findSynced.mockResolvedValue([
        {
          id: 'cap-1',
          rawContent: '/path/to/audio.m4a',
          fileSize: 5 * 1024 * 1024,
          capturedAt: old,
          syncStatus: 'synced',
          transcription: 'Important transcription',
          todos: ['Important todo'],
          createdAt: old,
          updatedAt: old,
          type: 'audio',
          state: 'captured',
        },
      ] as any);

      // FileSystem now injected via IFileSystem - no need to mock
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {} as any,
      });

      await service.executeCleanup();

      // Only rawContent and fileSize cleared - all other fields preserved
      expect(mockRepository.update).toHaveBeenCalledWith('cap-1', {
        rawContent: '',
        fileSize: null,
      });
    });
  });
});
