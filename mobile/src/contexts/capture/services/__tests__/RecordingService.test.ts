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
    it('should throw error if microphone permission is denied', async () => {
      // Mock permission denied
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(false);

      await expect(service.startRecording()).rejects.toThrow('MicrophonePermissionDenied');
    });

    it('should create a Capture entity with state "recording" when starting', async () => {
      // Mock permission granted
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);

      // Mock repository create
      mockRepository.create.mockResolvedValue({
        id: 'capture-123',
        _raw: {
          id: 'capture-123',
          type: 'audio',
          state: 'recording',
          sync_status: 'pending',
        },
      } as any);

      await service.startRecording();

      // Verify Capture entity was created with correct state
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audio',
          state: 'recording',
          syncStatus: 'pending',
        })
      );
    });

    it('should throw error if already recording', async () => {
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({ id: 'capture-123' } as any);

      // Start first recording
      await service.startRecording();

      // Try to start second recording
      await expect(service.startRecording()).rejects.toThrow('RecordingAlreadyInProgress');
    });
  });

  describe('stopRecording', () => {
    it('should throw error if no recording in progress', async () => {
      await expect(service.stopRecording()).rejects.toThrow('NoRecordingInProgress');
    });

    it('should update Capture entity with state "captured" and file metadata', async () => {
      // Start recording first
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({ id: 'capture-123' } as any);
      await service.startRecording();

      // Mock update
      mockRepository.update.mockResolvedValue({
        id: 'capture-123',
        _raw: {
          state: 'captured',
          raw_content: 'capture_user-123_1234567890_uuid.m4a',
        },
      } as any);

      const result = await service.stopRecording();

      // Verify Capture was updated with captured state
      expect(mockRepository.update).toHaveBeenCalledWith(
        'capture-123',
        expect.objectContaining({
          state: 'captured',
          rawContent: expect.stringContaining('.m4a'),
        })
      );

      expect(result).toBeDefined();
      expect(result.captureId).toBe('capture-123');
    });
  });

  describe('getCurrentRecordingId', () => {
    it('should return null when not recording', () => {
      expect(service.getCurrentRecordingId()).toBeNull();
    });

    it('should return capture id when recording', async () => {
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({ id: 'capture-123' } as any);

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
      mockRepository.create.mockResolvedValue({ id: 'capture-123' } as any);

      await service.startRecording();

      expect(service.isRecording()).toBe(true);
    });

    it('should return false after stopping', async () => {
      (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
      mockRepository.create.mockResolvedValue({ id: 'capture-123' } as any);
      mockRepository.update.mockResolvedValue({ id: 'capture-123' } as any);

      await service.startRecording();
      await service.stopRecording();

      expect(service.isRecording()).toBe(false);
    });
  });
});
