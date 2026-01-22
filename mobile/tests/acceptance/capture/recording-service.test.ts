/**
 * Integration Tests: RecordingService
 *
 * Story 2.1 - AC1, AC2, AC4, AC5
 * Tests failing in RED phase - waiting for implementation
 * Run: npm run test:acceptance
 */

import { RecordingService } from '@/contexts/Capture/services/RecordingService';
import { CrashRecoveryService } from '@/contexts/Capture/services/CrashRecoveryService';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// Mock expo modules
jest.mock('expo-av');
jest.mock('expo-file-system/legacy');
jest.mock('expo-haptics');

describe('RecordingService Integration Tests', () => {
  let recordingService: RecordingService;

  beforeEach(() => {
    jest.clearAllMocks();
    recordingService = new RecordingService();
  });

  describe('AC1: Start Recording with < 500ms Latency', () => {
    it('should start recording and return within 500ms', async () => {
      // GIVEN: RecordingService is initialized
      const startTime = Date.now();

      // WHEN: Start recording is called
      await recordingService.startRecording();

      // THEN: Recording starts within 500ms (NFR1)
      const latency = Date.now() - startTime;
      expect(latency).toBeLessThan(500);
    });

    it('should create audio recording with correct configuration', async () => {
      // GIVEN: RecordingService ready
      const mockRecording = {
        startAsync: jest.fn().mockResolvedValue(undefined),
        getStatusAsync: jest.fn().mockResolvedValue({ isRecording: true }),
      };

      (Audio.Recording as jest.Mock).mockReturnValue(mockRecording);

      // WHEN: Start recording
      await recordingService.startRecording();

      // THEN: Audio recording is configured correctly
      expect(Audio.Recording).toHaveBeenCalled();
      expect(mockRecording.startAsync).toHaveBeenCalled();
    });

    it('should stream audio data to temporary file during recording', async () => {
      // GIVEN: Recording in progress
      await recordingService.startRecording();

      // WHEN: Audio data is captured
      // (Simulated - expo-av handles streaming internally)

      // THEN: Temporary file path is created
      const tempFilePath = recordingService.getCurrentRecordingPath();
      expect(tempFilePath).toBeDefined();
      expect(tempFilePath).toContain('capture_');
      expect(tempFilePath).toContain('.m4a');
    });
  });

  describe('AC2: Stop and Save Recording', () => {
    it('should stop recording immediately', async () => {
      // GIVEN: Recording is active
      await recordingService.startRecording();

      // WHEN: Stop recording is called
      const stopTime = Date.now();
      await recordingService.stopRecording();
      const stopLatency = Date.now() - stopTime;

      // THEN: Recording stops immediately (< 100ms)
      expect(stopLatency).toBeLessThan(100);
      expect(recordingService.isRecording()).toBe(false);
    });

    it('should save audio file with metadata', async () => {
      // GIVEN: Recording completed
      await recordingService.startRecording();
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s recording

      // WHEN: Stop recording
      const result = await recordingService.stopRecording();

      // THEN: Audio file saved with metadata
      expect(result).toMatchObject({
        filePath: expect.stringContaining('.m4a'),
        duration: expect.any(Number),
        size: expect.any(Number),
        timestamp: expect.any(Date),
      });
    });

    it('should use secure file naming convention', async () => {
      // GIVEN: User ID and timestamp
      const userId = 'user-123';

      // WHEN: Generate file path
      const filePath = recordingService.generateFilePath(userId);

      // THEN: Follows pattern capture_{userId}_{timestamp}_{uuid}.m4a
      expect(filePath).toMatch(/capture_user-123_\d+_[a-f0-9-]+\.m4a/);
    });
  });

  describe('AC3: Offline Functionality', () => {
    it('should work without network connectivity', async () => {
      // GIVEN: No network (simulated)
      // Note: Network state is handled at app level, not RecordingService

      // WHEN: Start and stop recording
      await recordingService.startRecording();
      const result = await recordingService.stopRecording();

      // THEN: Recording succeeds offline
      expect(result.filePath).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('AC4: Crash Recovery', () => {
    it('should detect incomplete recordings on initialization', async () => {
      // GIVEN: Partial recording exists from crash
      const crashRecoveryService = new CrashRecoveryService();
      const partialFilePath = `${FileSystem.documentDirectory}capture_partial.m4a`;

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 5000,
      });

      // WHEN: Check for incomplete recordings
      const incompleteRecordings = await crashRecoveryService.detectIncompleteRecordings();

      // THEN: Partial recording is detected
      expect(incompleteRecordings.length).toBeGreaterThan(0);
      expect(incompleteRecordings[0].filePath).toContain('capture_');
    });

    it('should recover partial audio file if valid', async () => {
      // GIVEN: Partial recording with valid header
      const crashRecoveryService = new CrashRecoveryService();
      const partialPath = 'capture_partial.m4a';

      // WHEN: Attempt recovery
      const recovered = await crashRecoveryService.recoverRecording(partialPath);

      // THEN: Recording is recovered successfully
      expect(recovered).toBe(true);
    });

    it('should discard corrupted partial recordings', async () => {
      // GIVEN: Corrupted partial recording
      const crashRecoveryService = new CrashRecoveryService();
      const corruptedPath = 'capture_corrupted.m4a';

      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('File corrupted')
      );

      // WHEN: Attempt recovery
      const recovered = await crashRecoveryService.recoverRecording(corruptedPath);

      // THEN: Corrupted file is discarded
      expect(recovered).toBe(false);
    });
  });

  describe('AC5: Microphone Permission Handling', () => {
    it('should check microphone permission before recording', async () => {
      // GIVEN: Permission not granted
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
        granted: false,
      });

      // WHEN: Attempt to start recording
      const result = await recordingService.startRecording();

      // THEN: Permission is checked first
      expect(Audio.requestPermissionsAsync).toHaveBeenCalled();
      expect(result).toBeNull(); // Recording not started
    });

    it('should start recording only after permission granted', async () => {
      // GIVEN: Permission granted
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        granted: true,
      });

      // WHEN: Start recording
      await recordingService.startRecording();

      // THEN: Recording starts successfully
      expect(recordingService.isRecording()).toBe(true);
    });
  });
});
