/**
 * Tests for Recording Service - Audio Capture Business Logic
 *
 * Tests the orchestration of:
 * - expo-audio recording
 * - CaptureRepository persistence
 * - Permission checks
 * - File system operations
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC1: Start Recording with < 500ms Latency
 * AC2: Stop and Save Recording
 * AC5: Microphone Permission Handling
 *
 * Story: 2.3 - Annuler Capture Audio
 * AC1: Cancel Recording with Immediate Stop
 * AC5: Offline Cancellation Support
 */

import { RecordingService } from '../RecordingService';
import { CaptureRepository } from '../../data/CaptureRepository';
import { RepositoryResultType } from '../../domain/Result';
import * as FileSystem from 'expo-file-system';

// Mock dependencies
jest.mock('../../data/CaptureRepository');
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

describe('RecordingService', () => {
  let service: RecordingService;
  let mockRepository: jest.Mocked<CaptureRepository>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock repository instance
    mockRepository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      findByState: jest.fn(),
    } as any;

    service = new RecordingService(mockRepository);
  });

  describe('startRecording', () => {
    it('should create a Capture entity with state "recording" when starting', async () => {
      // Mock repository create
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          type: 'audio',
          state: 'recording',
          rawContent: 'file:///temp/recording.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        } as any,
      });

      const result = await service.startRecording('file:///temp/recording.m4a');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toEqual({ captureId: 'capture-123' });

      // Verify Capture entity was created with correct state
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audio',
          state: 'recording',
          rawContent: 'file:///temp/recording.m4a',
          syncStatus: 'pending',
        })
      );
    });

    it('should return validation error if already recording', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });

      // Start first recording
      await service.startRecording('file:///temp/recording1.m4a');

      // Try to start second recording
      const result = await service.startRecording('file:///temp/recording2.m4a');

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('RecordingAlreadyInProgress');
    });
  });

  describe('stopRecording', () => {
    it('should return validation error if no recording in progress', async () => {
      const result = await service.stopRecording('file:///final/recording.m4a', 5000);

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('NoRecordingInProgress');
    });

    it('should update Capture entity with state "captured" and file metadata', async () => {
      // Start recording first
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });
      await service.startRecording('file:///temp/recording.m4a');

      // Mock update
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          type: 'audio',
          state: 'captured',
          rawContent: 'file:///final/recording.m4a',
          duration: 5000,
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        } as any,
      });

      const result = await service.stopRecording('file:///final/recording.m4a', 5000);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBeDefined();
      expect(result.data?.captureId).toBe('capture-123');
      expect(result.data?.filePath).toBe('file:///final/recording.m4a');
      expect(result.data?.duration).toBe(5000);

      // Verify Capture was updated with captured state
      expect(mockRepository.update).toHaveBeenCalledWith(
        'capture-123',
        expect.objectContaining({
          state: 'captured',
          rawContent: 'file:///final/recording.m4a',
          duration: 5000,
        })
      );
    });
  });

  describe('getCurrentRecordingId', () => {
    it('should return null when not recording', () => {
      expect(service.getCurrentRecordingId()).toBeNull();
    });

    it('should return capture id when recording', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });

      await service.startRecording('file:///temp/recording.m4a');

      expect(service.getCurrentRecordingId()).toBe('capture-123');
    });
  });

  describe('isRecording', () => {
    it('should return false when not recording', () => {
      expect(service.isRecording()).toBe(false);
    });

    it('should return true when recording', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });

      await service.startRecording('file:///temp/recording.m4a');

      expect(service.isRecording()).toBe(true);
    });

    it('should return false after stopping', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });

      await service.startRecording('file:///temp/recording.m4a');
      await service.stopRecording('file:///final/recording.m4a', 5000);

      expect(service.isRecording()).toBe(false);
    });
  });

  describe('Story 2.3: cancelRecording', () => {
    it('should delete audio file and capture entity when canceling', async () => {
      // Start recording first
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          type: 'audio',
          state: 'recording',
          rawContent: 'file:///path/to/audio.m4a',
        } as any,
      });
      await service.startRecording('file:///path/to/audio.m4a');

      // Mock getById to return the capture
      mockRepository.findById.mockResolvedValue({
        id: 'capture-123',
        type: 'audio',
        state: 'recording',
        rawContent: 'file:///path/to/audio.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      // Mock FileSystem
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      // Cancel recording
      const result = await service.cancelRecording();

      // Should return success
      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      // Should check if file exists
      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith('file:///path/to/audio.m4a');

      // Should delete the file
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///path/to/audio.m4a',
        { idempotent: true }
      );

      // Should delete the capture entity
      expect(mockRepository.delete).toHaveBeenCalledWith('capture-123');

      // Should reset state
      expect(service.isRecording()).toBe(false);
      expect(service.getCurrentRecordingId()).toBeNull();
    });

    it('should handle file not found gracefully', async () => {
      // Start recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          rawContent: 'file:///path/to/audio.m4a',
        } as any,
      });
      await service.startRecording('file:///path/to/audio.m4a');

      mockRepository.findById.mockResolvedValue({
        id: 'capture-123',
        rawContent: 'file:///path/to/audio.m4a',
      } as any);

      // Mock file doesn't exist
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      // Cancel should return success
      const result = await service.cancelRecording();
      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      // Should still delete entity
      expect(mockRepository.delete).toHaveBeenCalledWith('capture-123');
    });

    it('should handle file deletion errors gracefully (AC5: offline support)', async () => {
      // Start recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          rawContent: 'file:///path/to/audio.m4a',
        } as any,
      });
      await service.startRecording('file:///path/to/audio.m4a');

      mockRepository.findById.mockResolvedValue({
        id: 'capture-123',
        rawContent: 'file:///path/to/audio.m4a',
      } as any);

      // Mock file system error
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('File system error'));

      // Cancel should return success (file errors are non-critical)
      const result = await service.cancelRecording();
      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      // Should still delete entity
      expect(mockRepository.delete).toHaveBeenCalledWith('capture-123');
    });

    it('should do nothing if not currently recording', async () => {
      // Call cancel without starting recording
      const result = await service.cancelRecording();

      // Should return success (no-op is not an error)
      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      // Should not call any repository methods
      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(mockRepository.delete).not.toHaveBeenCalled();
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should handle capture with no file URI', async () => {
      // Start recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          rawContent: '',
        } as any,
      });
      await service.startRecording('');

      // Mock getById returns capture with no URI
      mockRepository.findById.mockResolvedValue({
        id: 'capture-123',
        rawContent: null,
      } as any);

      // Cancel should return success
      const result = await service.cancelRecording();
      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalledWith('capture-123');
    });

    it('should return database error when deletion fails', async () => {
      // Start recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          rawContent: 'file:///path/to/audio.m4a',
        } as any,
      });
      await service.startRecording('file:///path/to/audio.m4a');

      mockRepository.findById.mockResolvedValue({
        id: 'capture-123',
        rawContent: 'file:///path/to/audio.m4a',
      } as any);

      // Mock file operations succeed but DB deletion fails
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      mockRepository.delete.mockRejectedValue(new Error('Database connection lost'));

      // Cancel should return error
      const result = await service.cancelRecording();
      expect(result.type).toBe(RepositoryResultType.DATABASE_ERROR);
      expect(result.error).toContain('Failed to cancel recording');
      expect(result.error).toContain('Database connection lost');

      // Should still reset state
      expect(service.isRecording()).toBe(false);
      expect(service.getCurrentRecordingId()).toBeNull();
    });
  });
});
