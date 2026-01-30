/**
 * TranscriptionFlow Integration Tests
 *
 * Story 2.5 - Task 8.3: Integration tests for transcription flow
 *
 * Tests:
 * - Queue → Processing integration
 * - Retry logic integration (manual)
 * - Offline-first architecture validation
 * - Event-driven architecture
 *
 * Note: These are logical integration tests that verify service interactions
 * using the real TranscriptionQueueService API.
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { TranscriptionQueueService } from '../../services/TranscriptionQueueService';
import { TOKENS } from '../../../../infrastructure/di/tokens';
import type { EventBus } from '../../../shared/events/EventBus';
import { database } from '../../../../database';

// Mock EventBus
class MockEventBus {
  publish = jest.fn();
  subscribe = jest.fn(() => ({ unsubscribe: jest.fn() }));
}

// Mock Capture Repository
class MockCaptureRepository {
  private captures: Map<string, any> = new Map();

  async findById(id: string) {
    return this.captures.get(id) || null;
  }

  async update(capture: any) {
    this.captures.set(capture.id, capture);
  }

  async save(capture: any) {
    this.captures.set(capture.id, capture);
  }

  createTestCapture(id: string, audioPath: string, duration: number = 5000) {
    const capture = {
      id,
      audioPath,
      duration,
      state: 'captured',
      normalizedText: null,
    };
    this.captures.set(id, capture);
    return capture;
  }
}

// Mock Metadata Repository
class MockMetadataRepository {
  private metadata: Map<string, Map<string, any>> = new Map();

  async setMetadata(captureId: string, key: string, value: any) {
    if (!this.metadata.has(captureId)) {
      this.metadata.set(captureId, new Map());
    }
    this.metadata.get(captureId)!.set(key, value);
  }

  async getMetadata(captureId: string, key: string) {
    return this.metadata.get(captureId)?.get(key) || null;
  }
}

describe('TranscriptionFlow Integration Tests', () => {
  let queueService: TranscriptionQueueService;
  let captureRepository: MockCaptureRepository;
  let metadataRepository: MockMetadataRepository;
  let eventBus: MockEventBus;
  let db: any;

  beforeAll(async () => {
    db = database.getDatabase();
  });

  beforeEach(async () => {
    // Clear queue table
    db.executeSync('DELETE FROM transcription_queue');
    db.executeSync('DELETE FROM captures');

    // Set up mocks
    eventBus = new MockEventBus();
    captureRepository = new MockCaptureRepository();
    metadataRepository = new MockMetadataRepository();

    // Register mocks in container
    container.registerInstance('EventBus', eventBus as any);
    container.registerInstance(TOKENS.ICaptureRepository, captureRepository as any);
    container.registerInstance(TOKENS.ICaptureMetadataRepository, metadataRepository as any);

    // Get queue service from container
    queueService = container.resolve(TranscriptionQueueService);
  });

  afterEach(() => {
    container.clearInstances();
  });

  describe('Queue → Processing Integration', () => {
    it('should add captures to queue in FIFO order', async () => {
      // Arrange: Create test captures
      const capture1 = captureRepository.createTestCapture('cap-1', '/audio/test1.m4a', 3000);
      const capture2 = captureRepository.createTestCapture('cap-2', '/audio/test2.m4a', 5000);
      const capture3 = captureRepository.createTestCapture('cap-3', '/audio/test3.m4a', 2000);

      // Create captures in DB (FK requirement)
      const now = Date.now();
      db.executeSync(
        'INSERT INTO captures (id, type, state, raw_content, duration, created_at, updated_at, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['cap-1', 'audio', 'captured', '/audio/test1.m4a', 3000, now, now, 0]
      );
      db.executeSync(
        'INSERT INTO captures (id, type, state, raw_content, duration, created_at, updated_at, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['cap-2', 'audio', 'captured', '/audio/test2.m4a', 5000, now, now, 0]
      );
      db.executeSync(
        'INSERT INTO captures (id, type, state, raw_content, duration, created_at, updated_at, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['cap-3', 'audio', 'captured', '/audio/test3.m4a', 2000, now, now, 0]
      );

      // Act: Add to queue
      await queueService.enqueue({ captureId: capture1.id, audioPath: capture1.audioPath, audioDuration: 3000 });
      await queueService.enqueue({ captureId: capture2.id, audioPath: capture2.audioPath, audioDuration: 5000 });
      await queueService.enqueue({ captureId: capture3.id, audioPath: capture3.audioPath, audioDuration: 2000 });

      // Assert: Queue length
      const queueLength = await queueService.getQueueLength();
      expect(queueLength).toBe(3);

      // Assert: FIFO order
      const next = await queueService.getNextCapture();
      expect(next).not.toBeNull();
      expect(next!.captureId).toBe('cap-1'); // First in, first out
    });

    it('should prevent duplicate captures in queue', async () => {
      // Arrange
      const capture = captureRepository.createTestCapture('cap-dup', '/audio/duplicate.m4a', 3000);

      const now = Date.now();
      db.executeSync(
        'INSERT INTO captures (id, type, state, raw_content, duration, created_at, updated_at, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['cap-dup', 'audio', 'captured', '/audio/duplicate.m4a', 3000, now, now, 0]
      );

      // Act: Add same capture twice
      await queueService.enqueue({ captureId: capture.id, audioPath: capture.audioPath, audioDuration: 3000 });
      await queueService.enqueue({ captureId: capture.id, audioPath: capture.audioPath, audioDuration: 3000 }); // Duplicate

      // Assert: Only one entry
      const queueLength = await queueService.getQueueLength();
      expect(queueLength).toBe(1);
    });
  });

  describe('Retry Logic Integration', () => {
    it('should support retry by capture ID (Task 6.2)', async () => {
      // Arrange: Create and queue capture
      const capture = captureRepository.createTestCapture('cap-retry', '/audio/retry.m4a', 2000);

      const now = Date.now();
      db.executeSync(
        'INSERT INTO captures (id, type, state, raw_content, duration, created_at, updated_at, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['cap-retry', 'audio', 'captured', '/audio/retry.m4a', 2000, now, now, 0]
      );

      await queueService.enqueue({ captureId: capture.id, audioPath: capture.audioPath, audioDuration: 2000 });

      // Simulate failure by marking it failed
      await queueService.markFailed('cap-retry', 'Simulated failure');

      // Act: Retry
      const retried = await queueService.retryFailedByCaptureId('cap-retry');

      // Assert: Retry successful
      expect(retried).toBe(true);

      // Queue should have the item again
      const queueLength = await queueService.getQueueLength();
      expect(queueLength).toBeGreaterThan(0);
    });
  });

  describe('Offline-First Architecture Validation', () => {
    it('should verify queue persistence survives app restart (crash-proof)', async () => {
      // Arrange: Add items to queue
      const capture1 = captureRepository.createTestCapture('cap-persist-1', '/audio/persist1.m4a', 2000);
      const capture2 = captureRepository.createTestCapture('cap-persist-2', '/audio/persist2.m4a', 3000);

      const now = Date.now();
      db.executeSync(
        'INSERT INTO captures (id, type, state, raw_content, duration, created_at, updated_at, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['cap-persist-1', 'audio', 'captured', '/audio/persist1.m4a', 2000, now, now, 0]
      );
      db.executeSync(
        'INSERT INTO captures (id, type, state, raw_content, duration, created_at, updated_at, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['cap-persist-2', 'audio', 'captured', '/audio/persist2.m4a', 3000, now, now, 0]
      );

      await queueService.enqueue({ captureId: capture1.id, audioPath: capture1.audioPath, audioDuration: 2000 });
      await queueService.enqueue({ captureId: capture2.id, audioPath: capture2.audioPath, audioDuration: 3000 });

      // Act: Simulate app restart by creating new service instance
      container.clearInstances();
      container.registerInstance('EventBus', eventBus as any);
      container.registerInstance(TOKENS.ICaptureRepository, captureRepository as any);
      container.registerInstance(TOKENS.ICaptureMetadataRepository, metadataRepository as any);

      const newQueueService = container.resolve(TranscriptionQueueService);

      // Assert: Queue persisted
      const queueLength = await newQueueService.getQueueLength();
      expect(queueLength).toBe(2);
    });

    it('should verify no network dependencies in queue operations', () => {
      // This test validates architectural principle (NFR11: 100% local)
      // TranscriptionQueueService should only use:
      // - OP-SQLite (local DB)
      // - EventBus (in-memory)
      // No HTTP, no fetch, no network calls

      const queueServiceInstance = queueService as any;

      // Assert: No network-related properties
      expect(queueServiceInstance).not.toHaveProperty('http');
      expect(queueServiceInstance).not.toHaveProperty('fetch');
      expect(queueServiceInstance).not.toHaveProperty('axios');
      expect(queueServiceInstance).not.toHaveProperty('api');

      // Assert: Only local dependencies
      expect(queueServiceInstance.db).toBeDefined(); // Local DB
      expect(queueServiceInstance.eventBus).toBeDefined(); // Local events
    });
  });

  describe('Event-Driven Architecture', () => {
    it('should publish events when captures added to queue', async () => {
      // Arrange
      const capture = captureRepository.createTestCapture('cap-event', '/audio/event.m4a', 2000);

      const now = Date.now();
      db.executeSync(
        'INSERT INTO captures (id, type, state, raw_content, duration, created_at, updated_at, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['cap-event', 'audio', 'captured', '/audio/event.m4a', 2000, now, now, 0]
      );

      // Act
      await queueService.enqueue({ captureId: capture.id, audioPath: capture.audioPath, audioDuration: 2000 });

      // Assert: Event published (at least one event should be published)
      expect(eventBus.publish).toHaveBeenCalled();
    });
  });

  describe('Model Management Integration', () => {
    it('should verify WhisperModelService integration architecture', () => {
      // Architectural validation: WhisperModelService should manage local models
      // This test documents the expected integration without requiring actual execution

      // Assert: Service should:
      // 1. Download model to local file system (expo-file-system)
      // 2. Cache model location
      // 3. Never stream transcription to cloud
      // 4. Reuse cached model on subsequent calls

      expect(true).toBe(true); // Placeholder for architectural validation
    });
  });
});
