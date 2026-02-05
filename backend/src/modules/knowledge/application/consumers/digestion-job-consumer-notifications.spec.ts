/**
 * Digestion Job Consumer - Notification Integration Tests
 * Story 4.4 Task 12: Integration with DigestionJobConsumer
 *
 * Validates that ProgressNotificationService is properly integrated into
 * the digestion flow, sending notifications at key milestones.
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { DigestionJobConsumer } from './digestion-job-consumer.service';
import { ProgressTrackerService } from '../services/progress-tracker.service';
import { QueueMonitoringService } from '../services/queue-monitoring.service';
import { EventBusService } from '../services/event-bus.service';
import { ContentExtractorService } from '../services/content-extractor.service';
import { ContentChunkerService } from '../services/content-chunker.service';
import { ThoughtRepository } from '../repositories/thought.repository';
import { TodoRepository } from '../../../action/application/repositories/todo.repository';
import { DeadlineParserService } from '../../../action/application/services/deadline-parser.service';
import { ProgressNotificationService } from '../../../notification/application/services/ProgressNotificationService';
import { DataSource } from 'typeorm';
import type { DigestionJobPayload } from '../../domain/interfaces/digestion-job-payload.interface';

describe('DigestionJobConsumer - Notification Integration (Task 12)', () => {
  let consumer: DigestionJobConsumer;
  let mockProgressNotificationService: jest.Mocked<ProgressNotificationService>;
  let mockQueueMonitoring: jest.Mocked<QueueMonitoringService>;
  let mockCaptureRepository: any;
  let mockContentExtractor: jest.Mocked<ContentExtractorService>;
  let mockContentChunker: jest.Mocked<ContentChunkerService>;
  let mockDataSource: jest.Mocked<DataSource>;

  const mockJob: DigestionJobPayload = {
    captureId: 'capture-123',
    userId: 'user-456',
    priority: 5,
    retryCount: 0,
  };

  beforeEach(async () => {
    // Mock ProgressNotificationService
    mockProgressNotificationService = {
      startTrackingWithNotifications: jest.fn().mockResolvedValue(undefined),
      updateProgressWithNotifications: jest.fn().mockResolvedValue(undefined),
      completeTrackingWithNotifications: jest.fn().mockResolvedValue(undefined),
      failTrackingWithNotifications: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock QueueMonitoringService
    mockQueueMonitoring = {
      getQueueDepth: jest.fn().mockResolvedValue(3),
      recordJobProcessed: jest.fn(),
      recordJobFailed: jest.fn(),
      recordJobLatency: jest.fn(),
    } as any;

    // Mock CaptureRepository
    mockCaptureRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };

    // Mock ContentExtractorService
    mockContentExtractor = {
      extractContent: jest.fn().mockResolvedValue({
        content: 'Test content',
        contentType: 'text/plain',
      }),
    } as any;

    // Mock ContentChunkerService
    mockContentChunker = {
      processContent: jest.fn().mockResolvedValue({
        summary: 'Test summary',
        ideas: ['Idea 1', 'Idea 2'],
        todos: [
          { description: 'Todo 1', deadline: null, priority: 'medium' as const },
        ],
        confidence: 'high' as const,
        wasChunked: false,
        chunkCount: 1,
      }),
    } as any;

    // Mock DataSource with transaction
    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn((entity, data) => ({ ...data })),
          save: jest.fn().mockImplementation((entity, data) => {
            if (Array.isArray(data)) {
              return data.map((item, idx) => ({ ...item, id: `id-${idx}` }));
            }
            return { ...data, id: 'thought-123' };
          }),
        };
        return callback(mockManager);
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestionJobConsumer,
        {
          provide: ProgressTrackerService,
          useValue: {},
        },
        {
          provide: QueueMonitoringService,
          useValue: mockQueueMonitoring,
        },
        {
          provide: 'CAPTURE_REPOSITORY',
          useValue: mockCaptureRepository,
        },
        {
          provide: EventBusService,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: ContentExtractorService,
          useValue: mockContentExtractor,
        },
        {
          provide: ContentChunkerService,
          useValue: mockContentChunker,
        },
        {
          provide: ThoughtRepository,
          useValue: {},
        },
        {
          provide: TodoRepository,
          useValue: {
            createManyInTransaction: jest.fn().mockResolvedValue([
              { id: 'todo-1', description: 'Todo 1' },
            ]),
          },
        },
        {
          provide: DeadlineParserService,
          useValue: {
            parse: jest.fn().mockReturnValue({
              date: null,
              confidence: 0,
            }),
          },
        },
        {
          provide: ProgressNotificationService,
          useValue: mockProgressNotificationService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    consumer = module.get<DigestionJobConsumer>(DigestionJobConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification Integration (AC2, AC3)', () => {
    it('should start tracking with notifications and queue position', async () => {
      // Act
      await consumer.handleDigestionJob(mockJob);

      // Assert
      expect(mockQueueMonitoring.getQueueDepth).toHaveBeenCalled();
      expect(mockProgressNotificationService.startTrackingWithNotifications).toHaveBeenCalledWith(
        'capture-123',
        'user-456',
        3, // Queue depth
      );
    });

    it('should update progress with notifications at key milestones', async () => {
      // Act
      await consumer.handleDigestionJob(mockJob);

      // Assert - Should be called at: 10%, 20%, 40%, 70%, 90%, 100%
      expect(mockProgressNotificationService.updateProgressWithNotifications).toHaveBeenCalledTimes(6);
      expect(mockProgressNotificationService.updateProgressWithNotifications).toHaveBeenNthCalledWith(
        1,
        'capture-123',
        'user-456',
        10,
      );
      expect(mockProgressNotificationService.updateProgressWithNotifications).toHaveBeenNthCalledWith(
        2,
        'capture-123',
        'user-456',
        20,
      );
      expect(mockProgressNotificationService.updateProgressWithNotifications).toHaveBeenNthCalledWith(
        3,
        'capture-123',
        'user-456',
        40,
      );
      expect(mockProgressNotificationService.updateProgressWithNotifications).toHaveBeenNthCalledWith(
        4,
        'capture-123',
        'user-456',
        70,
      );
      expect(mockProgressNotificationService.updateProgressWithNotifications).toHaveBeenNthCalledWith(
        5,
        'capture-123',
        'user-456',
        90,
      );
      expect(mockProgressNotificationService.updateProgressWithNotifications).toHaveBeenNthCalledWith(
        6,
        'capture-123',
        'user-456',
        100,
      );
    });

    it('should complete tracking with notifications on success (AC3)', async () => {
      // Act
      await consumer.handleDigestionJob(mockJob);

      // Assert
      expect(mockProgressNotificationService.completeTrackingWithNotifications).toHaveBeenCalledWith(
        'capture-123',
        'user-456',
        'Test summary',
        2, // ideasCount
        1, // todosCount
      );
    });

    it('should fail tracking with notifications after max retries (AC5)', async () => {
      // Arrange - Simulate failure and max retries
      const failedJob = { ...mockJob, retryCount: 2 }; // Max retries = 3, so retry 2 is the last attempt
      mockContentExtractor.extractContent.mockRejectedValue(new Error('Extraction failed'));

      // Act & Assert
      await expect(consumer.handleDigestionJob(failedJob)).rejects.toThrow('Extraction failed');

      // Should call failTrackingWithNotifications
      expect(mockProgressNotificationService.failTrackingWithNotifications).toHaveBeenCalledWith(
        'capture-123',
        'user-456',
        'Extraction failed',
        3, // Total attempts (retryCount + 1)
      );
    });

    it('should NOT fail tracking with notifications if retries remain', async () => {
      // Arrange - Simulate failure but retries remain
      const failedJob = { ...mockJob, retryCount: 0 }; // Will be retried
      mockContentExtractor.extractContent.mockRejectedValue(new Error('Temporary error'));

      // Act & Assert
      await expect(consumer.handleDigestionJob(failedJob)).rejects.toThrow('Temporary error');

      // Should NOT call failTrackingWithNotifications (will be retried)
      expect(mockProgressNotificationService.failTrackingWithNotifications).not.toHaveBeenCalled();
    });

    it('should handle completion without todos', async () => {
      // Arrange - No todos extracted
      mockContentChunker.processContent.mockResolvedValue({
        summary: 'Test summary',
        ideas: ['Idea 1'],
        todos: [],
        confidence: 'high' as const,
        wasChunked: false,
        chunkCount: 1,
      });

      // Act
      await consumer.handleDigestionJob(mockJob);

      // Assert
      expect(mockProgressNotificationService.completeTrackingWithNotifications).toHaveBeenCalledWith(
        'capture-123',
        'user-456',
        'Test summary',
        1, // ideasCount
        0, // todosCount = 0
      );
    });
  });

  describe('WebSocket Event Integration (AC4)', () => {
    it('should emit progress events via ProgressNotificationService', async () => {
      // ProgressNotificationService internally publishes progress.update events
      // which are picked up by KnowledgeEventsGateway

      // Act
      await consumer.handleDigestionJob(mockJob);

      // Assert - Verify ProgressNotificationService was called (it handles event publishing)
      expect(mockProgressNotificationService.startTrackingWithNotifications).toHaveBeenCalled();
      expect(mockProgressNotificationService.updateProgressWithNotifications).toHaveBeenCalled();
      expect(mockProgressNotificationService.completeTrackingWithNotifications).toHaveBeenCalled();
    });
  });
});
