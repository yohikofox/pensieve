import 'reflect-metadata';
import { container } from 'tsyringe';
import { TranscriptionQueueService } from '../TranscriptionQueueService';
import { database } from '../../../../database';
import type { EventBus } from '../../../shared/events/EventBus';

describe('TranscriptionQueueService', () => {
  let service: TranscriptionQueueService;
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
    // Clear all tables before each test (FK cascade will clean transcription_queue)
    const db = database.getDatabase();
    db.executeSync('DELETE FROM captures');  // Cascade deletes transcription_queue entries
    db.executeSync('DELETE FROM app_settings WHERE key = \'transcription_queue_paused\'');

    // Create mock EventBus
    mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    } as unknown as EventBus;

    // Register mock EventBus in container
    container.registerInstance('EventBus', mockEventBus);

    // Use container to resolve service with proper DI
    service = container.resolve(TranscriptionQueueService);
  });

  describe('enqueue', () => {
    it('should add capture to queue in FIFO order', async () => {
      // Arrange
      const capture1 = { captureId: '1', audioPath: '/audio1.m4a' };
      const capture2 = { captureId: '2', audioPath: '/audio2.m4a' };
      const capture3 = { captureId: '3', audioPath: '/audio3.m4a' };

      createCapture('1', '/audio1.m4a');
      createCapture('2', '/audio2.m4a');
      createCapture('3', '/audio3.m4a');

      // Act
      await service.enqueue(capture1);
      await service.enqueue(capture2);
      await service.enqueue(capture3);

      // Assert
      expect(await service.getQueueLength()).toBe(3);

      const next = await service.getNextCapture();
      expect(next).not.toBeNull();
      expect(next!.captureId).toBe('1'); // FIFO: first in, first out
    });

    it('should not add duplicate captures to queue', async () => {
      // Arrange
      const capture = { captureId: '1', audioPath: '/audio1.m4a' };

      createCapture('1', '/audio1.m4a');

      // Act
      await service.enqueue(capture);
      await service.enqueue(capture); // Duplicate

      // Assert
      expect(await service.getQueueLength()).toBe(1);
    });

    it('should store audio duration when provided', async () => {
      // Arrange
      const capture = {
        captureId: '1',
        audioPath: '/audio1.m4a',
        audioDuration: 60000, // 60 seconds
      };

      createCapture('1', '/audio1.m4a', 60000);

      // Act
      await service.enqueue(capture);
      const next = await service.getNextCapture();

      // Assert
      expect(next).not.toBeNull();
      expect(next!.audioDuration).toBe(60000);
    });
  });

  describe('getNextCapture', () => {
    it('should return null if queue is empty', async () => {
      // Act
      const next = await service.getNextCapture();

      // Assert
      expect(next).toBeNull();
    });

    it('should return captures in FIFO order', async () => {
      // Arrange
      const capture1 = { captureId: '1', audioPath: '/audio1.m4a' };
      const capture2 = { captureId: '2', audioPath: '/audio2.m4a' };

      createCapture('1', '/audio1.m4a');
      createCapture('2', '/audio2.m4a');

      await service.enqueue(capture1);
      await service.enqueue(capture2);

      // Act & Assert
      const first = await service.getNextCapture();
      expect(first).not.toBeNull();
      expect(first!.captureId).toBe('1');

      const second = await service.getNextCapture();
      expect(second).not.toBeNull();
      expect(second!.captureId).toBe('2');

      const third = await service.getNextCapture();
      expect(third).toBeNull();
    });

    it('should remove capture from queue after retrieval', async () => {
      // Arrange
      const capture = { captureId: '1', audioPath: '/audio1.m4a' };

      createCapture('1', '/audio1.m4a');

      await service.enqueue(capture);

      // Act
      await service.getNextCapture();

      // Assert
      expect(await service.getQueueLength()).toBe(0);
    });

    it('should return capture with correct status and metadata', async () => {
      // Arrange
      const capture = {
        captureId: '1',
        audioPath: '/audio1.m4a',
        audioDuration: 30000,
      };

      createCapture('1', '/audio1.m4a', 30000);

      await service.enqueue(capture);

      // Act
      const next = await service.getNextCapture();

      // Assert
      expect(next).not.toBeNull();
      expect(next!.captureId).toBe('1');
      expect(next!.audioPath).toBe('/audio1.m4a');
      expect(next!.audioDuration).toBe(30000);
      expect(next!.status).toBe('pending');
      expect(next!.retryCount).toBe(0);
      expect(next!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('remove', () => {
    it('should remove specific capture from queue', async () => {
      // Arrange
      const capture1 = { captureId: '1', audioPath: '/audio1.m4a' };
      const capture2 = { captureId: '2', audioPath: '/audio2.m4a' };

      createCapture('1', '/audio1.m4a');
      createCapture('2', '/audio2.m4a');

      await service.enqueue(capture1);
      await service.enqueue(capture2);

      // Act
      await service.remove('1');

      // Assert
      expect(await service.getQueueLength()).toBe(1);

      const next = await service.getNextCapture();
      expect(next).not.toBeNull();
      expect(next!.captureId).toBe('2');
    });

    it('should not fail if capture not in queue', async () => {
      // Act & Assert
      await expect(service.remove('non-existent')).resolves.not.toThrow();
    });
  });

  describe('pause and resume', () => {
    it('should pause queue processing', async () => {
      // Act
      await service.pause();

      // Assert
      expect(await service.isPaused()).toBe(true);
    });

    it('should resume queue processing', async () => {
      // Arrange
      await service.pause();

      // Act
      await service.resume();

      // Assert
      expect(await service.isPaused()).toBe(false);
    });

    it('should default to not paused', async () => {
      // Assert
      expect(await service.isPaused()).toBe(false);
    });
  });

  describe('getQueueLength', () => {
    it('should return 0 for empty queue', async () => {
      // Assert
      expect(await service.getQueueLength()).toBe(0);
    });

    it('should return correct queue length', async () => {
      // Arrange
      createCapture('1', '/audio1.m4a');
      createCapture('2', '/audio2.m4a');

      await service.enqueue({ captureId: '1', audioPath: '/audio1.m4a' });
      await service.enqueue({ captureId: '2', audioPath: '/audio2.m4a' });

      // Assert
      expect(await service.getQueueLength()).toBe(2);
    });

    it('should update length after dequeue', async () => {
      // Arrange
      createCapture('1', '/audio1.m4a');
      createCapture('2', '/audio2.m4a');

      await service.enqueue({ captureId: '1', audioPath: '/audio1.m4a' });
      await service.enqueue({ captureId: '2', audioPath: '/audio2.m4a' });

      // Act
      await service.getNextCapture();

      // Assert
      expect(await service.getQueueLength()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all captures from queue', async () => {
      // Arrange
      createCapture('1', '/audio1.m4a');
      createCapture('2', '/audio2.m4a');

      await service.enqueue({ captureId: '1', audioPath: '/audio1.m4a' });
      await service.enqueue({ captureId: '2', audioPath: '/audio2.m4a' });

      // Act
      await service.clear();

      // Assert
      expect(await service.getQueueLength()).toBe(0);
    });
  });

  describe('markFailed and retryFailed', () => {
    it('should mark capture as failed with error message', async () => {
      // Arrange
      const captureId = '1';
      const capture = { captureId, audioPath: '/audio1.m4a' };

      createCapture(captureId, '/audio1.m4a');

      await service.enqueue(capture);

      // Get queue entry to obtain its ID (for verification)
      const db = database.getDatabase();
      const result = db.executeSync(
        'SELECT id FROM transcription_queue WHERE capture_id = ?',
        [captureId]
      );
      const queueId = result.rows![0].id;

      // Act - markFailed expects captureId, not queueId
      await service.markFailed(captureId, 'Test error');

      // Assert
      const failedResult = db.executeSync(
        'SELECT status, retry_count, last_error FROM transcription_queue WHERE id = ?',
        [queueId]
      );
      expect(failedResult.rows![0].status).toBe('failed');
      expect(failedResult.rows![0].retry_count).toBe(1);
      expect(failedResult.rows![0].last_error).toBe('Test error');
    });

    it('should retry failed capture', async () => {
      // Arrange
      const captureId = '1';
      const capture = { captureId, audioPath: '/audio1.m4a' };

      createCapture(captureId, '/audio1.m4a');

      await service.enqueue(capture);

      const db = database.getDatabase();
      const result = db.executeSync(
        'SELECT id FROM transcription_queue WHERE capture_id = ?',
        [captureId]
      );
      const queueId = result.rows![0].id;

      // markFailed expects captureId
      await service.markFailed(captureId, 'Test error');

      // Act
      await service.retryFailed(queueId);

      // Assert
      const retriedResult = db.executeSync(
        'SELECT status, started_at FROM transcription_queue WHERE id = ?',
        [queueId]
      );
      expect(retriedResult.rows![0].status).toBe('pending');
      expect(retriedResult.rows![0].started_at).toBeNull();
    });
  });

  describe('DB persistence (crash-proof)', () => {
    it('should persist queue across service instances', async () => {
      // Arrange
      const capture1 = { captureId: '1', audioPath: '/audio1.m4a' };
      const capture2 = { captureId: '2', audioPath: '/audio2.m4a' };

      createCapture('1', '/audio1.m4a');
      createCapture('2', '/audio2.m4a');

      await service.enqueue(capture1);
      await service.enqueue(capture2);

      // Act - Create new service instance (simulates app restart)
      // Use container.resolve to get proper DI with EventBus
      const newService = container.resolve(TranscriptionQueueService);

      // Assert - Queue persisted in DB
      expect(await newService.getQueueLength()).toBe(2);

      const next = await newService.getNextCapture();
      expect(next).not.toBeNull();
      expect(next!.captureId).toBe('1');
    });

    it('should persist pause state across service instances', async () => {
      // Arrange
      await service.pause();

      // Act - Create new service instance via container
      const newService = container.resolve(TranscriptionQueueService);

      // Assert - Pause state persisted in DB
      expect(await newService.isPaused()).toBe(true);
    });
  });
});
