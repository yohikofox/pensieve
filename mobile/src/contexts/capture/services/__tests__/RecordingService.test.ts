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
 */

import { RecordingService } from '../RecordingService';
import { CaptureRepository } from '../../data/CaptureRepository';
import { PermissionService } from '../PermissionService';
import { RepositoryResultType } from '../../domain/Result';

// Mock dependencies
jest.mock('../../data/CaptureRepository');
jest.mock('../PermissionService');

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
      findById: jest.fn(),
      findByState: jest.fn(),
    } as any;

    service = new RecordingService(mockRepository);
  });

  describe('startRecording', () => {
    it('should return validation error if microphone permission is denied', async () => {
      // Mock permission denied
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(false);

      const result = await service.startRecording();

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('MicrophonePermissionDenied');
    });

    it('should create a Capture entity with state "recording" when starting', async () => {
      // Mock permission granted
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);

      // Mock repository create
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          type: 'audio',
          state: 'recording',
          rawContent: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        } as any,
      });

      const result = await service.startRecording();

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toEqual({ captureId: 'capture-123' });

      // Verify Capture entity was created with correct state
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audio',
          state: 'recording',
          syncStatus: 'pending',
        })
      );
    });

    it('should return validation error if already recording', async () => {
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });

      // Start first recording
      await service.startRecording();

      // Try to start second recording
      const result = await service.startRecording();

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('RecordingAlreadyInProgress');
    });
  });

  describe('stopRecording', () => {
    it('should return validation error if no recording in progress', async () => {
      const result = await service.stopRecording();

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('NoRecordingInProgress');
    });

    it('should update Capture entity with state "captured" and file metadata', async () => {
      // Start recording first
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });
      await service.startRecording();

      // Mock update
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          type: 'audio',
          state: 'captured',
          rawContent: 'capture_user-123_1234567890_uuid.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          capturedAt: new Date(),
          syncStatus: 'pending',
        } as any,
      });

      const result = await service.stopRecording();

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBeDefined();
      expect(result.data?.captureId).toBe('capture-123');

      // Verify Capture was updated with captured state
      expect(mockRepository.update).toHaveBeenCalledWith(
        'capture-123',
        expect.objectContaining({
          state: 'captured',
        })
      );
    });
  });

  describe('getCurrentRecordingId', () => {
    it('should return null when not recording', () => {
      expect(service.getCurrentRecordingId()).toBeNull();
    });

    it('should return capture id when recording', async () => {
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });

      await service.startRecording();

      expect(service.getCurrentRecordingId()).toBe('capture-123');
    });
  });

  describe('isRecording', () => {
    it('should return false when not recording', () => {
      expect(service.isRecording()).toBe(false);
    });

    it('should return true when recording', async () => {
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });

      await service.startRecording();

      expect(service.isRecording()).toBe(true);
    });

    it('should return false after stopping', async () => {
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });
      mockRepository.update.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-123' } as any,
      });

      await service.startRecording();
      await service.stopRecording();

      expect(service.isRecording()).toBe(false);
    });
  });
});
