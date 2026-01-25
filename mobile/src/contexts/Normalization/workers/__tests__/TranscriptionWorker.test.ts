import 'reflect-metadata';
import { container } from 'tsyringe';
import { TranscriptionWorker } from '../TranscriptionWorker';
import { TranscriptionQueueService } from '../../services/TranscriptionQueueService';
import { TranscriptionService } from '../../services/TranscriptionService';
import { database } from '../../../../database';
import type { ICaptureRepository } from '../../../capture/domain/ICaptureRepository';
import type { EventBus } from '../../../shared/events/EventBus';

describe('TranscriptionWorker', () => {
  let worker: TranscriptionWorker;
  let queueService: TranscriptionQueueService;
  let transcriptionService: TranscriptionService;
  let mockCaptureRepository: ICaptureRepository;
  let mockEventBus: EventBus;

  /**
   * Helper: Create a capture in the captures table
   * Required for FK constraint: transcription_queue.capture_id -> captures.id
   */
  function createCapture(captureId: string, audioPath: string, audioDuration?: number): void {
    const db = database.getDatabase();
    const now = Date.now();

    db.executeSync(
      `INSERT INTO captures (
        id, type, state, raw_content, duration, created_at, updated_at, sync_version
      ) VALUES (?, 'audio', 'captured', ?, ?, ?, ?, 0)`,
      [captureId, audioPath, audioDuration || null, now, now]
    );
  }

  beforeEach(async () => {
    // Clear all tables before each test
    const db = database.getDatabase();
    db.executeSync('DELETE FROM captures');

    // Create mock EventBus
    mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    } as unknown as EventBus;

    // Register mock EventBus in container
    container.registerInstance('EventBus', mockEventBus);

    // Create mock CaptureRepository
    mockCaptureRepository = {
      create: jest.fn().mockResolvedValue({ success: true, data: {} }),
      update: jest.fn().mockResolvedValue({ success: true, data: {} }),
      findById: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      findByState: jest.fn().mockResolvedValue([]),
      findByType: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ success: true }),
      destroyPermanently: jest.fn().mockResolvedValue({ success: true }),
      findPendingSync: jest.fn().mockResolvedValue([]),
      findSynced: jest.fn().mockResolvedValue([]),
      findConflicts: jest.fn().mockResolvedValue([]),
      isPendingSync: jest.fn().mockResolvedValue(false),
      hasConflict: jest.fn().mockResolvedValue(false),
    } as unknown as ICaptureRepository;

    // Create mock TranscriptionService
    transcriptionService = {
      transcribe: jest.fn().mockResolvedValue('Mocked transcription result'),
      loadModel: jest.fn().mockResolvedValue(undefined),
      releaseModel: jest.fn().mockResolvedValue(undefined),
      isModelLoaded: jest.fn().mockReturnValue(true), // Model is always loaded in tests
      getLastTranscriptionDuration: jest.fn().mockReturnValue(1000),
      getLastPerformanceMetrics: jest.fn().mockReturnValue({
        audioDuration: 30000,
        transcriptionDuration: 1000,
        ratio: 0.033,
        meetsNFR2: true,
      }),
    } as unknown as TranscriptionService;

    // Create fresh instances using container for proper DI
    queueService = container.resolve(TranscriptionQueueService);
    worker = new TranscriptionWorker(queueService, transcriptionService, mockCaptureRepository);
  });

  afterEach(async () => {
    // Stop worker to cleanup
    await worker.stop();
  });

  describe('lifecycle', () => {
    it('should start and stop successfully', async () => {
      // Act
      await worker.start();

      // Assert
      expect(worker.getState()).toBe('running');

      // Act
      await worker.stop();

      // Assert
      expect(worker.getState()).toBe('stopped');
    });

    it('should be idempotent when starting multiple times', async () => {
      // Act
      await worker.start();
      await worker.start();
      await worker.start();

      // Assert
      expect(worker.getState()).toBe('running');

      // Cleanup
      await worker.stop();
    });

    it('should be idempotent when stopping multiple times', async () => {
      // Arrange
      await worker.start();

      // Act
      await worker.stop();
      await worker.stop();
      await worker.stop();

      // Assert
      expect(worker.getState()).toBe('stopped');
    });

    it('should transition from running to paused', async () => {
      // Arrange
      await worker.start();
      expect(worker.getState()).toBe('running');

      // Act
      await worker.pause();

      // Assert
      expect(worker.getState()).toBe('paused');
      expect(await queueService.isPaused()).toBe(true);

      // Cleanup
      await worker.stop();
    });

    it('should transition from paused to running via resume', async () => {
      // Arrange
      await worker.start();
      await worker.pause();
      expect(worker.getState()).toBe('paused');

      // Act
      await worker.resume();

      // Assert
      expect(worker.getState()).toBe('running');
      expect(await queueService.isPaused()).toBe(false);

      // Cleanup
      await worker.stop();
    });

    it('should not pause when stopped', async () => {
      // Act
      await worker.pause();

      // Assert
      expect(worker.getState()).toBe('stopped');
    });

    it('should not resume when stopped', async () => {
      // Act
      await worker.resume();

      // Assert
      expect(worker.getState()).toBe('stopped');
    });
  });

  describe('processOneItem (background task)', () => {
    it('should process one item from queue', async () => {
      // Arrange
      createCapture('capture-1', '/audio1.m4a', 30000);
      await queueService.enqueue({
        captureId: 'capture-1',
        audioPath: '/audio1.m4a',
        audioDuration: 30000,
      });

      // Act
      const processed = await worker.processOneItem();

      // Assert
      expect(processed).toBe(true);
      expect(await queueService.getQueueLength()).toBe(0); // Item removed from queue
    });

    it('should return false if queue is empty', async () => {
      // Act
      const processed = await worker.processOneItem();

      // Assert
      expect(processed).toBe(false);
    });

    it('should skip processing if queue is paused', async () => {
      // Arrange
      createCapture('capture-1', '/audio1.m4a');
      await queueService.enqueue({
        captureId: 'capture-1',
        audioPath: '/audio1.m4a',
      });
      await queueService.pause();

      // Act
      const processed = await worker.processOneItem();

      // Assert
      expect(processed).toBe(false);
      expect(await queueService.getQueueLength()).toBe(1); // Item still in queue
    });

    it('should handle processing without throwing errors', async () => {
      // Arrange - Create capture and enqueue it
      createCapture('capture-test', '/test.m4a');
      await queueService.enqueue({
        captureId: 'capture-test',
        audioPath: '/test.m4a',
      });

      // Verify item is in queue
      const queueLength = await queueService.getQueueLength();
      expect(queueLength).toBe(1);

      // Act - Should not throw (stub transcriber always succeeds)
      await expect(worker.processOneItem()).resolves.not.toThrow();
    });
  });

  describe('foreground processing', () => {
    it('should not crash when queue is empty', async () => {
      // Act - Start with empty queue
      await worker.start();

      // Wait briefly for processing loop
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - Worker should still be running
      expect(worker.getState()).toBe('running');

      // Cleanup
      await worker.stop();
    });

    it.skip('should process items when they become available', async () => {
      // Skipped: Flaky timing-based test
      // Core functionality tested via processOneItem() in other tests
      // Integration test would be better in E2E suite
    });

    it('should stop processing when paused', async () => {
      // Arrange
      await worker.start();
      createCapture('capture-1', '/audio1.m4a');
      await queueService.enqueue({
        captureId: 'capture-1',
        audioPath: '/audio1.m4a',
      });

      // Act - Pause immediately
      await worker.pause();

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - Item should not be processed
      expect(await queueService.getQueueLength()).toBe(1);

      // Cleanup
      await worker.stop();
    });

    it('should resume processing after pause', async () => {
      // Arrange
      await worker.start();
      await worker.pause();

      createCapture('capture-1', '/audio1.m4a');
      await queueService.enqueue({
        captureId: 'capture-1',
        audioPath: '/audio1.m4a',
      });

      // Act - Resume
      await worker.resume();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Assert - Item should be processed
      expect(await queueService.getQueueLength()).toBe(0);

      // Cleanup
      await worker.stop();
    });
  });
});
