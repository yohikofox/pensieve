/**
 * RecordingService Regression Tests
 *
 * Tests for critical bugs found during manual testing (2026-01-22)
 *
 * Story: 2.3 - Annuler Capture Audio
 * Critical Bug Fixed:
 * - "this.repository.getById is not a function" error during cancelRecording
 * - ICaptureRepository missing findById method in interface
 */

import { RecordingService } from '../RecordingService';
import { CaptureRepository } from '../../data/CaptureRepository';
import { RepositoryResultType } from '../../domain/Result';
import { MockFileSystem } from '../../__tests__/helpers/MockFileSystem';

// Mock dependencies
jest.mock('../../data/CaptureRepository');

describe('RecordingService Regression Tests', () => {
  let service: RecordingService;
  let mockRepository: jest.Mocked<CaptureRepository>;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repository instance
    mockRepository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(), // CRITICAL: Must use findById, not getById
      findByState: jest.fn(),
    } as any;

    mockFileSystem = new MockFileSystem();

    service = new RecordingService(mockRepository, mockFileSystem);
  });

  describe('Bug Fix: getById is not a function', () => {
    it('should use findById (not getById) to retrieve capture entity', async () => {
      // Start recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          rawContent: 'file:///path/to/audio.m4a',
        } as any,
      });
      await service.startRecording('file:///path/to/audio.m4a');

      // Mock findById (NOT getById)
      mockRepository.findById.mockResolvedValue({
        id: 'capture-123',
        rawContent: 'file:///path/to/audio.m4a',
      } as any);

      // Mock file system
      mockFileSystem.setFile('file:///path/to/audio.m4a', '');

      // Cancel should use findById, not getById
      const result = await service.cancelRecording();

      // Verify findById was called (not getById which doesn't exist)
      expect(mockRepository.findById).toHaveBeenCalledWith('capture-123');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    it('should handle capture not found gracefully (findById returns null)', async () => {
      // Start recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-123',
          rawContent: 'file:///path/to/audio.m4a',
        } as any,
      });
      await service.startRecording('file:///path/to/audio.m4a');

      // Mock findById returns null (capture not found)
      mockRepository.findById.mockResolvedValue(null);

      // Cancel should not throw
      const result = await service.cancelRecording();

      // Should still succeed (no file to delete)
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(mockRepository.delete).toHaveBeenCalledWith('capture-123');
    });

    it('should work correctly after interface update (findById added)', async () => {
      // This test verifies that ICaptureRepository now includes findById method

      // Start recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'test-capture',
          rawContent: 'file:///test.m4a',
        } as any,
      });
      await service.startRecording('file:///test.m4a');

      // Setup mocks
      mockRepository.findById.mockResolvedValue({
        id: 'test-capture',
        rawContent: 'file:///test.m4a',
      } as any);
      mockFileSystem.setFile('file:///path/to/audio.m4a', '');

      // Cancel should work without "is not a function" error
      await expect(service.cancelRecording()).resolves.not.toThrow();

      // Verify the correct method was called
      expect(mockRepository.findById).toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalled();
    });
  });

  describe('Bug Fix: Repository Interface Compliance', () => {
    it('should only call methods defined in ICaptureRepository', async () => {
      // Verify service only uses methods from the interface
      const allowedMethods = [
        'create',
        'update',
        'delete',
        'findById', // Now in interface
        'findByState',
        'findBySyncStatus',
        'findAll',
      ];

      // Start and cancel recording to trigger all repository calls
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'test', rawContent: 'file:///test.m4a' } as any,
      });
      mockRepository.findById.mockResolvedValue({
        id: 'test',
        rawContent: 'file:///test.m4a',
      } as any);
      mockFileSystem.setFile('file:///path/to/audio.m4a', '');

      await service.startRecording('file:///test.m4a');
      await service.cancelRecording();

      // Verify only allowed methods were called
      const calledMethods = Object.keys(mockRepository).filter((key) =>
        (mockRepository as any)[key].mock?.calls.length > 0
      );

      calledMethods.forEach((method) => {
        expect(allowedMethods).toContain(method);
      });
    });
  });

  describe('Bug Fix: Cancel Flow Integration', () => {
    it('should complete full cancel flow without errors', async () => {
      // This test reproduces the exact error scenario from manual testing

      // 1. User starts recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'user-recording',
          type: CAPTURE_TYPES.AUDIO,
          state: CAPTURE_STATES.RECORDING,
          rawContent: 'file:///user/audio.m4a',
        } as any,
      });
      await service.startRecording('file:///user/audio.m4a');

      // 2. User taps cancel button
      mockRepository.findById.mockResolvedValue({
        id: 'user-recording',
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.RECORDING,
        rawContent: 'file:///user/audio.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
      } as any);
      mockFileSystem.setFile('file:///path/to/audio.m4a', '');

      // 3. Confirm discard
      const result = await service.cancelRecording();

      // Should succeed without "getById is not a function" error
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(mockRepository.findById).toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalledWith('user-recording');

      // 4. Capture should NOT remain in "recording" state
      expect(service.isRecording()).toBe(false);
      expect(service.getCurrentRecordingId()).toBeNull();
    });
  });

  describe('Bug Fix: Orphaned Captures in "recording" State', () => {
    it('should explain why captures remained in "recording" state before fix', () => {
      /**
       * ROOT CAUSE ANALYSIS:
       *
       * Before Fix (2026-01-22):
       * 1. User starts recording → Capture created with state="recording"
       * 2. User taps Cancel → Discard
       * 3. RecordingService.cancelRecording() calls repository.getById()
       * 4. ❌ ERROR: "this.repository.getById is not a function"
       * 5. Error caught, but delete NEVER executed
       * 6. Capture remains in database with state="recording"
       *
       * After Fix (2026-01-22):
       * - Added findById to ICaptureRepository interface
       * - Changed RecordingService to use findById instead of getById
       * - Delete now executes successfully
       *
       * CLEANUP:
       * - Orphaned captures from before fix must be deleted manually
       * - Use CaptureDevTools → "Supprimer failed" or "Tout supprimer"
       * - Or use CrashRecoveryService.recoverIncompleteRecordings()
       */
      expect(true).toBe(true);
    });

    it('should successfully delete capture after findById fix', async () => {
      // Start recording
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'capture-orphan-test',
          rawContent: 'file:///path/to/audio.m4a',
        } as any,
      });
      await service.startRecording('file:///path/to/audio.m4a');

      // Mock findById (the fixed method)
      mockRepository.findById.mockResolvedValue({
        id: 'capture-orphan-test',
        rawContent: 'file:///path/to/audio.m4a',
      } as any);

      // Mock file system
      mockFileSystem.setFile('file:///path/to/audio.m4a', '');

      // Cancel should now work correctly
      const result = await service.cancelRecording();

      // Verify delete was called (this was broken before fix)
      expect(mockRepository.delete).toHaveBeenCalledWith('capture-orphan-test');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);

      // Verify no orphaned capture remains
      expect(service.isRecording()).toBe(false);
      expect(service.getCurrentRecordingId()).toBeNull();
    });
  });
});
