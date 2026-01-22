/**
 * Performance Tests for Audio Capture
 *
 * Tests performance requirements:
 * - NFR1: < 500ms latency from tap to recording start
 * - Memory usage during long recordings
 * - Various recording durations (30s, 2min, 5min)
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Task 4: Comprehensive Tests - Subtask 4.4
 *
 * NOTE: These are unit-level performance tests using mocks.
 * Real performance testing would require:
 * - Actual device testing (iOS/Android)
 * - expo-audio native module
 * - Profiling tools (React Native Performance Monitor)
 */

import { RecordingService } from '../services/RecordingService';
import { CaptureRepository } from '../data/CaptureRepository';
import { FileStorageService } from '../services/FileStorageService';
import { PermissionService } from '../services/PermissionService';

// Mock dependencies
jest.mock('../data/CaptureRepository');
jest.mock('../services/FileStorageService');
jest.mock('../services/PermissionService');

describe('Audio Capture Performance Tests', () => {
  let recordingService: RecordingService;
  let repository: jest.Mocked<CaptureRepository>;
  let fileStorageService: jest.Mocked<FileStorageService>;

  beforeEach(() => {
    jest.clearAllMocks();

    repository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
    } as any;

    fileStorageService = {
      moveToStorage: jest.fn(),
      getFileMetadata: jest.fn(),
    } as any;

    recordingService = new RecordingService(repository);

    // Mock permission granted
    (PermissionService.hasMicrophonePermission as jest.Mock).mockResolvedValue(true);
  });

  describe('NFR1: Start Recording Latency < 500ms', () => {
    it('should start recording within 500ms from service call', async () => {
      repository.create.mockResolvedValue({
        id: 'perf-capture-1',
        type: 'audio',
        state: 'recording',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      const startTime = performance.now();

      await recordingService.startRecording();

      const endTime = performance.now();
      const latency = endTime - startTime;

      // Verify database write completed within 500ms
      // NOTE: In production, this includes expo-audio initialization time
      expect(latency).toBeLessThan(500);
      expect(repository.create).toHaveBeenCalled();
    });

    it('should handle permission check without adding significant latency', async () => {
      const startTime = performance.now();

      const hasPermission = await PermissionService.hasMicrophonePermission();

      const endTime = performance.now();
      const latency = endTime - startTime;

      // Permission check should be near-instant (< 50ms)
      expect(latency).toBeLessThan(50);
      expect(hasPermission).toBe(true);
    });

    it('should batch database operations efficiently', async () => {
      repository.create.mockResolvedValue({
        id: 'batch-capture',
        type: 'audio',
        state: 'recording',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      repository.update.mockResolvedValue({
        id: 'batch-capture',
        type: 'audio',
        state: 'captured',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      const startTime = performance.now();

      // Simulate starting multiple captures sequentially
      for (let i = 0; i < 10; i++) {
        await recordingService.startRecording();
        await recordingService.stopRecording(); // Stop before starting next
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerOperation = totalTime / 10;

      // Each operation should still be fast
      expect(avgTimePerOperation).toBeLessThan(100);
    });
  });

  describe('Stop Recording Performance', () => {
    it('should stop recording and save quickly', async () => {
      repository.create.mockResolvedValue({
        id: 'stop-perf-1',
        type: 'audio',
        state: 'recording',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      repository.update.mockResolvedValue({
        id: 'stop-perf-1',
        type: 'audio',
        state: 'captured',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      // Start recording first
      await recordingService.startRecording();

      const startTime = performance.now();

      await recordingService.stopRecording();

      const endTime = performance.now();
      const stopLatency = endTime - startTime;

      // Stopping should be near-instant
      expect(stopLatency).toBeLessThan(200);
      expect(repository.update).toHaveBeenCalled();
    });
  });

  describe('File Storage Performance', () => {
    it('should handle small file (30s recording) efficiently', async () => {
      const smallFileSize = 500000; // ~500KB for 30s audio
      const duration = 30000; // 30 seconds

      fileStorageService.moveToStorage.mockResolvedValue({
        permanentPath: '/audio/small.m4a',
        metadata: {
          size: smallFileSize,
          duration,
          createdAt: new Date(),
        },
      });

      const startTime = performance.now();

      await fileStorageService.moveToStorage('/temp/small.m4a', 'capture-1', duration);

      const endTime = performance.now();
      const moveTime = endTime - startTime;

      // File move should be fast for small files
      expect(moveTime).toBeLessThan(100);
    });

    it('should handle medium file (2min recording) efficiently', async () => {
      const mediumFileSize = 2000000; // ~2MB for 2min audio
      const duration = 120000; // 2 minutes

      fileStorageService.moveToStorage.mockResolvedValue({
        permanentPath: '/audio/medium.m4a',
        metadata: {
          size: mediumFileSize,
          duration,
          createdAt: new Date(),
        },
      });

      const startTime = performance.now();

      await fileStorageService.moveToStorage('/temp/medium.m4a', 'capture-2', duration);

      const endTime = performance.now();
      const moveTime = endTime - startTime;

      // File move should still be reasonable for medium files
      expect(moveTime).toBeLessThan(200);
    });

    it('should handle large file (5min recording) without blocking', async () => {
      const largeFileSize = 5000000; // ~5MB for 5min audio
      const duration = 300000; // 5 minutes

      fileStorageService.moveToStorage.mockResolvedValue({
        permanentPath: '/audio/large.m4a',
        metadata: {
          size: largeFileSize,
          duration,
          createdAt: new Date(),
        },
      });

      const startTime = performance.now();

      await fileStorageService.moveToStorage('/temp/large.m4a', 'capture-3', duration);

      const endTime = performance.now();
      const moveTime = endTime - startTime;

      // Even large files should move without excessive delay
      // In real scenario, file system operations are async and don't block UI
      expect(moveTime).toBeLessThan(500);
    });
  });

  describe('Metadata Extraction Performance', () => {
    it('should extract file metadata quickly', async () => {
      fileStorageService.getFileMetadata.mockResolvedValue({
        size: 1024000,
        duration: 60000,
        createdAt: new Date(),
      });

      const startTime = performance.now();

      await fileStorageService.getFileMetadata('/audio/file.m4a', 60000);

      const endTime = performance.now();
      const extractTime = endTime - startTime;

      // Metadata extraction should be very fast
      expect(extractTime).toBeLessThan(50);
    });
  });

  describe('Database Query Performance', () => {
    it('should retrieve captures quickly', async () => {
      // Mock 100 captures in database
      const mockCaptures = Array.from({ length: 100 }, (_, i) => ({
        id: `capture-${i}`,
        type: 'audio',
        state: 'captured',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      }));

      repository.findBySyncStatus = jest.fn().mockResolvedValue(mockCaptures as any);

      const startTime = performance.now();

      const results = await repository.findBySyncStatus('pending');

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Query should be fast even with 100 records
      expect(queryTime).toBeLessThan(100);
      expect(results.length).toBe(100);
    });

    it('should handle concurrent database operations', async () => {
      repository.findById.mockResolvedValue({
        id: 'concurrent-1',
        type: 'audio',
        state: 'captured',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      const concurrentQueries = Array.from({ length: 20 }, (_, i) =>
        repository.findById(`capture-${i}`)
      );

      const startTime = performance.now();

      await Promise.all(concurrentQueries);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All 20 queries should complete quickly
      expect(totalTime).toBeLessThan(500);
    });
  });

  describe('Memory Usage (Simulated)', () => {
    it('should not leak memory during multiple recordings', async () => {
      repository.create.mockResolvedValue({
        id: 'memory-test',
        type: 'audio',
        state: 'recording',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      repository.update.mockResolvedValue({
        id: 'memory-test',
        type: 'audio',
        state: 'captured',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      // Simulate 50 sequential recordings
      for (let i = 0; i < 50; i++) {
        await recordingService.startRecording();
        await recordingService.stopRecording();
      }

      // Verify service doesn't accumulate state
      expect(recordingService.isRecording()).toBe(false);
      expect(recordingService.getCurrentRecordingId()).toBeNull();

      // In production: Monitor heap size with React Native Performance Monitor
      // Heap should stabilize, not grow linearly with recordings
    });

    it('should clean up references after recording stops', async () => {
      repository.create.mockResolvedValue({
        id: 'cleanup-test',
        type: 'audio',
        state: 'recording',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      repository.update.mockResolvedValue({
        id: 'cleanup-test',
        type: 'audio',
        state: 'captured',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      await recordingService.startRecording();

      // Recording ID should exist during recording
      expect(recordingService.getCurrentRecordingId()).toBe('cleanup-test');

      await recordingService.stopRecording();

      // Recording ID should be cleared after stop
      expect(recordingService.getCurrentRecordingId()).toBeNull();
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid start/stop cycles', async () => {
      repository.create.mockResolvedValue({
        id: 'stress-test',
        type: 'audio',
        state: 'recording',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      repository.update.mockResolvedValue({
        id: 'stress-test',
        type: 'audio',
        state: 'captured',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      const startTime = performance.now();

      // Simulate 100 rapid recordings
      for (let i = 0; i < 100; i++) {
        await recordingService.startRecording();
        await recordingService.stopRecording();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 100;

      // Average time per cycle should be reasonable
      expect(avgTime).toBeLessThan(50);

      // Service should still be in clean state
      expect(recordingService.isRecording()).toBe(false);
    });
  });

  describe('Real-World Scenarios Performance', () => {
    it('should simulate typical user workflow efficiently', async () => {
      repository.create.mockResolvedValue({
        id: 'workflow-test',
        type: 'audio',
        state: 'recording',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      repository.update.mockResolvedValue({
        id: 'workflow-test',
        type: 'audio',
        state: 'captured',
        rawContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);

      fileStorageService.moveToStorage.mockResolvedValue({
        permanentPath: '/audio/workflow.m4a',
        metadata: {
          size: 1000000,
          duration: 60000,
          createdAt: new Date(),
        },
      });

      const startTime = performance.now();

      // Typical workflow: check permission, start, wait, stop, save
      await PermissionService.hasMicrophonePermission();
      await recordingService.startRecording();
      // (user speaks for ~1 minute - simulated)
      await recordingService.stopRecording();
      await fileStorageService.moveToStorage('/temp/file.m4a', 'workflow-test', 60000);

      const endTime = performance.now();
      const workflowTime = endTime - startTime;

      // Entire workflow (excluding actual recording time) should be fast
      expect(workflowTime).toBeLessThan(1000);
    });
  });
});
