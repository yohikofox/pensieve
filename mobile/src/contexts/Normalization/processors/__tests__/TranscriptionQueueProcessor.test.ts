import 'reflect-metadata';
import { container } from 'tsyringe';
import { TranscriptionQueueProcessor } from '../TranscriptionQueueProcessor';
import { TranscriptionQueueService } from '../../services/TranscriptionQueueService';
import { EventBus } from '../../../shared/events/EventBus';
import type { CaptureRecordedEvent, CaptureDeletedEvent } from '../../../Capture/events/CaptureEvents';
import { database } from '../../../../database';

describe('TranscriptionQueueProcessor', () => {
  let processor: TranscriptionQueueProcessor;
  let queueService: TranscriptionQueueService;
  let eventBus: EventBus;

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

    // Create fresh EventBus instance and register in container
    eventBus = new EventBus();
    container.registerInstance('EventBus', eventBus);

    // Resolve queue service via container (needs EventBus injection)
    queueService = container.resolve(TranscriptionQueueService);
    processor = new TranscriptionQueueProcessor(queueService, eventBus);
  });

  afterEach(() => {
    // Stop processor to cleanup subscriptions
    processor.stop();
  });

  describe('lifecycle', () => {
    it('should start and stop successfully', () => {
      // Act
      processor.start();

      // Assert
      expect(processor.isActive()).toBe(true);

      // Act
      processor.stop();

      // Assert
      expect(processor.isActive()).toBe(false);
    });

    it('should be idempotent when starting multiple times', () => {
      // Act
      processor.start();
      processor.start();
      processor.start();

      // Assert
      expect(processor.isActive()).toBe(true);

      // Cleanup
      processor.stop();
    });

    it('should be idempotent when stopping multiple times', () => {
      // Arrange
      processor.start();

      // Act
      processor.stop();
      processor.stop();
      processor.stop();

      // Assert
      expect(processor.isActive()).toBe(false);
    });
  });

  describe('auto-enqueue on CaptureRecorded', () => {
    it('should auto-enqueue audio capture', async () => {
      // Arrange
      createCapture('capture-1', '/audio1.m4a', 30000);
      processor.start();

      const event: CaptureRecordedEvent = {
        type: 'CaptureRecorded',
        timestamp: Date.now(),
        payload: {
          captureId: 'capture-1',
          captureType: 'audio',
          audioPath: '/audio1.m4a',
          audioDuration: 30000,
          createdAt: Date.now(),
        },
      };

      // Act
      eventBus.publish(event);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(await queueService.getQueueLength()).toBe(1);
      const next = await queueService.getNextCapture();
      expect(next).not.toBeNull();
      expect(next!.captureId).toBe('capture-1');
      expect(next!.audioPath).toBe('/audio1.m4a');
    });

    it('should skip text captures (no transcription needed)', async () => {
      // Arrange
      processor.start();

      const event: CaptureRecordedEvent = {
        type: 'CaptureRecorded',
        timestamp: Date.now(),
        payload: {
          captureId: 'capture-text',
          captureType: 'text',
          textContent: 'Some text',
          createdAt: Date.now(),
        },
      };

      // Act
      eventBus.publish(event);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - No capture should be enqueued
      expect(await queueService.getQueueLength()).toBe(0);
    });

    it('should not enqueue audio capture with missing audioPath', async () => {
      // Arrange
      processor.start();

      const event: CaptureRecordedEvent = {
        type: 'CaptureRecorded',
        timestamp: Date.now(),
        payload: {
          captureId: 'capture-invalid',
          captureType: 'audio',
          // Missing audioPath
          createdAt: Date.now(),
        },
      };

      // Act
      eventBus.publish(event);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - No capture should be enqueued
      expect(await queueService.getQueueLength()).toBe(0);
    });

    it('should not enqueue if processor is stopped', async () => {
      // Arrange
      createCapture('capture-1', '/audio1.m4a');
      // Don't start processor

      const event: CaptureRecordedEvent = {
        type: 'CaptureRecorded',
        timestamp: Date.now(),
        payload: {
          captureId: 'capture-1',
          captureType: 'audio',
          audioPath: '/audio1.m4a',
          createdAt: Date.now(),
        },
      };

      // Act
      eventBus.publish(event);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - No capture should be enqueued (processor not started)
      expect(await queueService.getQueueLength()).toBe(0);
    });
  });

  describe('auto-dequeue on CaptureDeleted', () => {
    it('should remove audio capture from queue when deleted', async () => {
      // Arrange - Create and enqueue capture
      createCapture('capture-1', '/audio1.m4a');
      await queueService.enqueue({
        captureId: 'capture-1',
        audioPath: '/audio1.m4a',
      });

      processor.start();

      const event: CaptureDeletedEvent = {
        type: 'CaptureDeleted',
        timestamp: Date.now(),
        payload: {
          captureId: 'capture-1',
          captureType: 'audio',
          audioPath: '/audio1.m4a',
        },
      };

      // Act
      eventBus.publish(event);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - Capture should be removed from queue
      expect(await queueService.getQueueLength()).toBe(0);
    });

    it('should skip text captures on delete (never in queue)', async () => {
      // Arrange
      processor.start();

      const event: CaptureDeletedEvent = {
        type: 'CaptureDeleted',
        timestamp: Date.now(),
        payload: {
          captureId: 'capture-text',
          captureType: 'text',
        },
      };

      // Act - Should not throw or cause issues
      eventBus.publish(event);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - No error (test passes)
      expect(processor.isActive()).toBe(true);
    });

    it('should handle delete of non-queued capture gracefully', async () => {
      // Arrange
      processor.start();

      const event: CaptureDeletedEvent = {
        type: 'CaptureDeleted',
        timestamp: Date.now(),
        payload: {
          captureId: 'capture-not-in-queue',
          captureType: 'audio',
          audioPath: '/audio.m4a',
        },
      };

      // Act - Should not throw
      eventBus.publish(event);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - No error (test passes)
      expect(processor.isActive()).toBe(true);
    });
  });

  describe('multiple events', () => {
    it('should handle multiple CaptureRecorded events', async () => {
      // Arrange
      createCapture('capture-1', '/audio1.m4a');
      createCapture('capture-2', '/audio2.m4a');
      createCapture('capture-3', '/audio3.m4a');

      processor.start();

      // Act - Publish multiple events
      const events: CaptureRecordedEvent[] = [
        {
          type: 'CaptureRecorded',
          timestamp: Date.now(),
          payload: {
            captureId: 'capture-1',
            captureType: 'audio',
            audioPath: '/audio1.m4a',
            createdAt: Date.now(),
          },
        },
        {
          type: 'CaptureRecorded',
          timestamp: Date.now(),
          payload: {
            captureId: 'capture-2',
            captureType: 'audio',
            audioPath: '/audio2.m4a',
            createdAt: Date.now(),
          },
        },
        {
          type: 'CaptureRecorded',
          timestamp: Date.now(),
          payload: {
            captureId: 'capture-3',
            captureType: 'audio',
            audioPath: '/audio3.m4a',
            createdAt: Date.now(),
          },
        },
      ];

      events.forEach((event) => eventBus.publish(event));

      // Wait for all async handlers
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Assert - All captures should be enqueued
      expect(await queueService.getQueueLength()).toBe(3);
    });
  });
});
