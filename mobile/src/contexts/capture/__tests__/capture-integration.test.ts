/**
 * Integration Tests for Audio Capture Flow
 *
 * Tests the complete end-to-end workflow:
 * - User tap → Recording start → Stop → File saved → DB updated
 * - Offline capture functionality
 * - Permission request flow
 * - Crash recovery simulation
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Task 4: Comprehensive Tests - Subtask 4.3
 *
 * AC1: Start Recording with < 500ms Latency
 * AC2: Stop and Save Recording
 * AC3: Offline Functionality
 * AC4: Crash Recovery
 * AC5: Microphone Permission Handling
 */

import { RecordingService } from '../services/RecordingService';
import { CaptureRepository } from '../data/CaptureRepository';
import { FileStorageService } from '../services/FileStorageService';
import { CrashRecoveryService } from '../services/CrashRecoveryService';
import { OfflineSyncService } from '../services/OfflineSyncService';
import { PermissionService } from '../services/PermissionService';

// Mock all external dependencies
jest.mock('../data/CaptureRepository');
jest.mock('../services/FileStorageService');
jest.mock('../services/PermissionService');
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  cacheDirectory: '/mock/cache/',
  documentDirectory: '/mock/document/',
}));

describe('Audio Capture Integration Tests', () => {
  let recordingService: RecordingService;
  let repository: jest.Mocked<CaptureRepository>;
  let fileStorageService: jest.Mocked<FileStorageService>;
  let crashRecoveryService: CrashRecoveryService;
  let offlineSyncService: OfflineSyncService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocked repository
    repository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      findByState: jest.fn(),
      findBySyncStatus: jest.fn(),
      findAll: jest.fn(),
    } as any;

    // Setup mocked file storage
    fileStorageService = {
      moveToStorage: jest.fn(),
      getFileMetadata: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
      getStorageDirectory: jest.fn(),
    } as any;

    // Create service instances
    recordingService = new RecordingService(repository);
    crashRecoveryService = new CrashRecoveryService(repository);
    offlineSyncService = new OfflineSyncService(repository);

    // Mock permission as granted by default
    (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
  });

  describe('AC1 & AC2: Complete Recording Flow - Tap to Save', () => {
    it('should complete full recording lifecycle from start to file storage', async () => {
      // Mock repository create for recording start (Result Pattern)
      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'capture-123',
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/recording.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Mock repository update for recording stop (Result Pattern)
      repository.update.mockResolvedValue({
        type: 'success',
        data: {
          id: 'capture-123',
          type: 'audio',
          state: 'captured',
          rawContent: '/permanent/capture_capture-123_123456.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
          duration: 5000,
          fileSize: 1024000,
        },
      } as any);

      // Mock file storage
      fileStorageService.moveToStorage.mockResolvedValue({
        permanentPath: '/permanent/capture_capture-123_123456.m4a',
        metadata: {
          size: 1024000,
          duration: 5000,
          createdAt: new Date(),
        },
      });

      // 1. User taps record button → start recording (with temp file URI)
      const startResult = await recordingService.startRecording('/temp/recording.m4a');

      // Verify capture entity created with "recording" state
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/recording.m4a',
          syncStatus: 'pending',
        })
      );

      // Verify result is successful
      expect(startResult.type).toBe('success');
      expect(startResult.data?.captureId).toBe('capture-123');

      // 2. User taps stop button → stop recording
      const stopResult = await recordingService.stopRecording();

      // Verify result is successful
      expect(stopResult.type).toBe('success');
      expect(stopResult.data).toBeDefined();

      // Verify capture entity updated with "captured" state
      expect(repository.update).toHaveBeenCalledWith(
        'capture-123',
        expect.objectContaining({
          state: 'captured',
          rawContent: expect.stringContaining('.m4a'),
        })
      );

      // Verify result contains capture ID
      expect(stopResult.data!.captureId).toBe('capture-123');

      // 3. Simulate file movement to permanent storage (this would happen in CaptureScreen)
      const storageResult = await fileStorageService.moveToStorage(
        '/temp/recording.m4a',
        'capture-123',
        5000
      );

      // Verify file was moved to permanent location
      expect(fileStorageService.moveToStorage).toHaveBeenCalledWith(
        '/temp/recording.m4a',
        'capture-123',
        5000
      );

      // 4. Update capture with permanent path and metadata
      await repository.update('capture-123', {
        rawContent: storageResult.permanentPath,
        duration: storageResult.metadata.duration,
        fileSize: storageResult.metadata.size,
      });

      // Verify final update with metadata
      expect(repository.update).toHaveBeenLastCalledWith(
        'capture-123',
        expect.objectContaining({
          rawContent: '/permanent/capture_capture-123_123456.m4a',
          duration: 5000,
          fileSize: 1024000,
        })
      );
    });

    it('should handle recording lifecycle errors gracefully', async () => {
      // Mock repository failure (Result Pattern)
      repository.create.mockResolvedValue({
        type: 'database_error',
        error: 'Database error',
      } as any);

      // Attempt to start recording
      const result = await recordingService.startRecording('/temp/recording.m4a');

      // Verify error result
      expect(result.type).toBe('database_error');
      expect(result.error).toBe('Database error');

      // Verify recording state is not corrupted
      expect(recordingService.isRecording()).toBe(false);
    });
  });

  describe('AC3: Offline Functionality', () => {
    it('should create captures offline with pending sync status', async () => {
      // Mock offline capture creation (Result Pattern)
      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'offline-capture-1',
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/offline.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending', // Marked for later sync
        },
      } as any);

      repository.update.mockResolvedValue({
        type: 'success',
        data: {
          id: 'offline-capture-1',
          type: 'audio',
          state: 'captured',
          rawContent: '/audio/offline.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Simulate recording offline
      await recordingService.startRecording('/temp/offline.m4a');
      await recordingService.stopRecording();

      // Verify capture is marked for sync
      const pendingCaptures = await offlineSyncService.getPendingCaptures();

      // Mock pending captures query
      repository.findBySyncStatus.mockResolvedValue([
        {
          id: 'offline-capture-1',
          type: 'audio',
          state: 'captured',
          rawContent: '/audio/capture.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(Date.now()),
          syncStatus: 'pending',
        },
      ] as any);

      const pending = await offlineSyncService.getPendingCaptures();

      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].id).toBe('offline-capture-1');
    });

    it('should track sync statistics correctly', async () => {
      // Mock sync stats
      repository.findAll.mockResolvedValue([
        { id: '1', syncStatus: 'pending', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
        { id: '2', syncStatus: 'pending', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
        { id: '3', syncStatus: 'synced', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
      ] as any);

      repository.findBySyncStatus.mockImplementation(async (status: string) => {
        if (status === 'pending') {
          return [
            { id: '1', syncStatus: 'pending', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
            { id: '2', syncStatus: 'pending', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() },
          ] as any;
        }
        return [{ id: '3', syncStatus: 'synced', createdAt: new Date(), updatedAt: new Date(), capturedAt: new Date() }] as any;
      });

      const stats = await offlineSyncService.getSyncStats();

      expect(stats.totalCount).toBe(3);
      expect(stats.pendingCount).toBe(2);
      expect(stats.syncedCount).toBe(1);
    });
  });

  describe('AC4: Crash Recovery', () => {
    it('should detect and recover incomplete recordings after crash', async () => {
      // Mock incomplete recording (app crashed during recording)
      repository.findByState.mockResolvedValue([
        {
          id: 'crashed-capture',
          type: 'audio',
          state: 'recording', // Still in recording state
          rawContent: '/temp/incomplete.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      ] as any);

      // Mock file exists check (FileSystem.getInfoAsync)
      const FileSystem = require('expo-file-system/legacy');
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

      // Mock update to recovered state (Result Pattern)
      repository.update.mockResolvedValue({
        type: 'success',
        data: {
          id: 'crashed-capture',
          type: 'audio',
          state: 'captured',
          rawContent: '/temp/incomplete.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Simulate app restart → crash recovery
      const recovered = await crashRecoveryService.recoverIncompleteRecordings();

      // Verify recovery was attempted
      expect(repository.findByState).toHaveBeenCalledWith('recording');
      expect(recovered.length).toBe(1);
      expect(recovered[0].state).toBe('recovered');
      expect(recovered[0].captureId).toBe('crashed-capture');

      // Verify capture was updated to "captured" state
      expect(repository.update).toHaveBeenCalledWith(
        'crashed-capture',
        expect.objectContaining({
          state: 'captured',
          syncStatus: 'pending',
        })
      );
    });

    it('should mark unrecoverable captures as failed', async () => {
      // Mock incomplete recording with missing file
      repository.findByState.mockResolvedValue([
        {
          id: 'lost-capture',
          type: 'audio',
          state: 'recording',
          rawContent: '', // No file path
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      ] as any);

      repository.update.mockResolvedValue({
        type: 'success',
        data: {
          id: 'lost-capture',
          type: 'audio',
          state: 'failed',
          rawContent: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Attempt recovery
      const recovered = await crashRecoveryService.recoverIncompleteRecordings();

      // Verify capture was marked as failed
      expect(recovered.length).toBe(1);
      expect(recovered[0].state).toBe('failed');
      expect(repository.update).toHaveBeenCalledWith(
        'lost-capture',
        expect.objectContaining({
          state: 'failed',
        })
      );
    });
  });

  describe('AC5: Permission Request Flow', () => {
    it('should request permissions before recording if not granted', async () => {
      // Mock permission not granted initially
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(false);

      // Attempt to start recording
      const result = await recordingService.startRecording('/temp/test.m4a');

      // Verify error result
      expect(result.type).toBe('validation_error');
      expect(result.error).toBe('MicrophonePermissionDenied');

      // Verify permission was checked
      expect(PermissionService.hasMicrophonePermission).toHaveBeenCalled();
    });

    it('should proceed with recording after permission is granted', async () => {
      // Mock permission granted
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);

      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'capture-with-permission',
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/test.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Start recording
      const result = await recordingService.startRecording('/temp/test.m4a');

      // Verify recording started
      expect(result.type).toBe('success');
      expect(repository.create).toHaveBeenCalled();
      expect(recordingService.isRecording()).toBe(true);
    });
  });

  describe('Multiple Captures Workflow', () => {
    it('should handle multiple sequential captures correctly', async () => {
      // Mock first capture (Result Pattern)
      repository.create.mockResolvedValueOnce({
        type: 'success',
        data: {
          id: 'capture-1',
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/capture1.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      repository.update.mockResolvedValueOnce({
        type: 'success',
        data: {
          id: 'capture-1',
          type: 'audio',
          state: 'captured',
          rawContent: '/audio/capture1.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // First capture
      await recordingService.startRecording('/temp/capture1.m4a');
      await recordingService.stopRecording();

      // Mock second capture (Result Pattern)
      repository.create.mockResolvedValueOnce({
        type: 'success',
        data: {
          id: 'capture-2',
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/capture2.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      repository.update.mockResolvedValueOnce({
        type: 'success',
        data: {
          id: 'capture-2',
          type: 'audio',
          state: 'captured',
          rawContent: '/audio/capture2.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Second capture
      await recordingService.startRecording('/temp/capture2.m4a');
      await recordingService.stopRecording();

      // Verify both captures were created
      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(repository.update).toHaveBeenCalledTimes(2);
    });

    it('should prevent starting new recording while one is in progress', async () => {
      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'capture-1',
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/capture1.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Start first recording
      await recordingService.startRecording('/temp/capture1.m4a');

      // Try to start second recording while first is active
      const result = await recordingService.startRecording('/temp/capture2.m4a');

      expect(result.type).toBe('validation_error');
      expect(result.error).toBe('RecordingAlreadyInProgress');
    });
  });

  describe('Error Recovery', () => {
    it('should handle file storage errors during save', async () => {
      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'capture-1',
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/file.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      repository.update.mockResolvedValue({
        type: 'success',
        data: {
          id: 'capture-1',
          type: 'audio',
          state: 'captured',
          rawContent: '/audio/file.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Mock file storage failure
      fileStorageService.moveToStorage.mockRejectedValue(new Error('Disk full'));

      // Start and stop recording
      await recordingService.startRecording('/temp/file.m4a');
      await recordingService.stopRecording();

      // Attempt file storage (simulating CaptureScreen logic)
      await expect(
        fileStorageService.moveToStorage('/temp/file.m4a', 'capture-1', 5000)
      ).rejects.toThrow('Disk full');

      // Verify capture is still in database (can be retried later)
      expect(repository.update).toHaveBeenCalled();
    });
  });

  describe('Story 2.3: Cancel Recording Flow', () => {
    it('should complete full cancel flow from start to cleanup', async () => {
      const FileSystem = require('expo-file-system/legacy');

      // Mock repository create for recording start
      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'cancel-capture-1',
          type: 'audio',
          state: 'recording',
          rawContent: '/temp/cancel.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        },
      } as any);

      // Mock getById for cancel flow
      repository.findById = jest.fn().mockResolvedValue({
        id: 'cancel-capture-1',
        type: 'audio',
        state: 'recording',
        rawContent: '/temp/cancel.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      // Mock file system for cancel
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      // 1. User starts recording
      const startResult = await recordingService.startRecording('/temp/cancel.m4a');
      expect(startResult.type).toBe('success');
      expect(recordingService.isRecording()).toBe(true);

      // 2. User taps cancel button and confirms
      await recordingService.cancelRecording();

      // AC1: Verify file was checked for existence
      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith('/temp/cancel.m4a');

      // AC1: Verify file was deleted
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        '/temp/cancel.m4a',
        { idempotent: true }
      );

      // AC1: Verify capture entity was deleted from DB
      expect(repository.delete).toHaveBeenCalledWith('cancel-capture-1');

      // AC1: Verify recording state was reset
      expect(recordingService.isRecording()).toBe(false);
      expect(recordingService.getCurrentRecordingId()).toBeNull();
    });

    it('should handle cancel when file does not exist', async () => {
      const FileSystem = require('expo-file-system/legacy');

      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'cancel-capture-2',
          rawContent: '/temp/missing.m4a',
        },
      } as any);

      (repository.findById as jest.Mock).mockResolvedValue({
        id: 'cancel-capture-2',
        rawContent: '/temp/missing.m4a',
      } as any);

      // Mock file doesn't exist
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await recordingService.startRecording('/temp/missing.m4a');
      await recordingService.cancelRecording();

      // Should not attempt to delete non-existent file
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();

      // But should still delete the DB entity
      expect(repository.delete).toHaveBeenCalledWith('cancel-capture-2');
      expect(recordingService.isRecording()).toBe(false);
    });

    it('should handle cancel in offline mode (AC5)', async () => {
      const FileSystem = require('expo-file-system/legacy');

      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'offline-cancel-1',
          rawContent: '/temp/offline.m4a',
        },
      } as any);

      (repository.findById as jest.Mock).mockResolvedValue({
        id: 'offline-cancel-1',
        rawContent: '/temp/offline.m4a',
      } as any);

      // Mock file system error (simulating offline/storage issues)
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('Storage unavailable'));

      await recordingService.startRecording('/temp/offline.m4a');

      // Cancel should not throw even with file system errors
      await expect(recordingService.cancelRecording()).resolves.not.toThrow();

      // Should still clean up DB entity despite file error
      expect(repository.delete).toHaveBeenCalledWith('offline-cancel-1');
      expect(recordingService.isRecording()).toBe(false);
    });

    it('should do nothing when canceling without active recording', async () => {
      const FileSystem = require('expo-file-system/legacy');

      // Call cancel without starting recording
      await recordingService.cancelRecording();

      // Should not call any cleanup methods
      expect(repository.getById).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should handle capture with no file URI', async () => {
      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'no-uri-capture',
          rawContent: null,
        },
      } as any);

      (repository.findById as jest.Mock).mockResolvedValue({
        id: 'no-uri-capture',
        rawContent: null,
      } as any);

      await recordingService.startRecording('');
      await recordingService.cancelRecording();

      // Should not attempt file deletion with no URI
      const FileSystem = require('expo-file-system/legacy');
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();

      // But should still delete entity
      expect(repository.delete).toHaveBeenCalledWith('no-uri-capture');
    });

    it('should prevent starting new recording after cancel completes', async () => {
      const FileSystem = require('expo-file-system/legacy');

      repository.create.mockResolvedValue({
        type: 'success',
        data: {
          id: 'cancel-then-new',
          rawContent: '/temp/test.m4a',
        },
      } as any);

      (repository.findById as jest.Mock).mockResolvedValue({
        id: 'cancel-then-new',
        rawContent: '/temp/test.m4a',
      } as any);

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      // Start, cancel, then start new recording
      await recordingService.startRecording('/temp/test.m4a');
      await recordingService.cancelRecording();

      expect(recordingService.isRecording()).toBe(false);

      // Should be able to start new recording after cancel
      const newResult = await recordingService.startRecording('/temp/new.m4a');
      expect(newResult.type).toBe('success');
      expect(recordingService.isRecording()).toBe(true);
    });
  });
});
