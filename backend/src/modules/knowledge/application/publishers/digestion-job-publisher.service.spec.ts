/**
 * DigestionJobPublisher Unit Tests
 * Tests for AC2: Automatic Job Publishing After Transcription
 *
 * Uses mocks to avoid dependency on RabbitMQ infrastructure
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { DigestionJobPublisher } from './digestion-job-publisher.service';
import { of, throwError } from 'rxjs';

describe('DigestionJobPublisher (AC2)', () => {
  let service: DigestionJobPublisher;
  let mockRabbitMQClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    // Mock RabbitMQ client
    mockRabbitMQClient = {
      emit: jest.fn().mockReturnValue(of(true)),
      send: jest.fn(),
      close: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestionJobPublisher,
        {
          provide: 'DIGESTION_QUEUE',
          useValue: mockRabbitMQClient,
        },
      ],
    }).compile();

    service = module.get<DigestionJobPublisher>(DigestionJobPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('publishJob', () => {
    it('should publish a digestion job with correct payload structure', async () => {
      // RED: This will fail - service doesn't exist yet
      const mockCapture = {
        captureId: 'capture-123',
        userId: 'user-456',
        type: 'AUDIO',
        state: 'transcribed',
      };

      await service.publishJob(mockCapture);

      expect(mockRabbitMQClient.emit).toHaveBeenCalledWith(
        'digestion.job.queued',
        expect.objectContaining({
          captureId: 'capture-123',
          userId: 'user-456',
          contentType: 'audio_transcribed',
          priority: 'normal',
          queuedAt: expect.any(Date),
          retryCount: 0,
        }),
      );
    });

    it('should include captureId, userId, contentType, and priority in payload', async () => {
      // RED: Will fail - service doesn't exist
      const mockCapture = {
        captureId: 'test-capture',
        userId: 'test-user',
        type: 'TEXT',
        state: 'ready',
      };

      await service.publishJob(mockCapture);

      const emittedPayload = mockRabbitMQClient.emit.mock.calls[0][1];

      expect(emittedPayload).toHaveProperty('captureId', 'test-capture');
      expect(emittedPayload).toHaveProperty('userId', 'test-user');
      expect(emittedPayload).toHaveProperty('contentType');
      expect(emittedPayload).toHaveProperty('priority');
    });

    it('should set priority to "high" for user-initiated captures', async () => {
      // RED: Will fail - priority logic doesn't exist
      const userInitiatedCapture = {
        captureId: 'capture-high',
        userId: 'user-123',
        type: 'AUDIO',
        state: 'transcribed',
        userInitiated: true, // Flag for high priority
      };

      await service.publishJob(userInitiatedCapture);

      const payload = mockRabbitMQClient.emit.mock.calls[0][1];
      expect(payload.priority).toBe('high');
    });

    it('should set priority to "normal" for auto-background captures', async () => {
      // RED: Will fail - priority logic doesn't exist
      const backgroundCapture = {
        captureId: 'capture-normal',
        userId: 'user-123',
        type: 'AUDIO',
        state: 'transcribed',
        userInitiated: false,
      };

      await service.publishJob(backgroundCapture);

      const payload = mockRabbitMQClient.emit.mock.calls[0][1];
      expect(payload.priority).toBe('normal');
    });

    it('should set contentType to "audio_transcribed" for audio captures', async () => {
      // RED: Will fail - content type mapping doesn't exist
      const audioCapture = {
        captureId: 'audio-cap',
        userId: 'user-1',
        type: 'AUDIO',
        state: 'transcribed',
      };

      await service.publishJob(audioCapture);

      const payload = mockRabbitMQClient.emit.mock.calls[0][1];
      expect(payload.contentType).toBe('audio_transcribed');
    });

    it('should set contentType to "text" for text captures', async () => {
      // RED: Will fail - content type mapping doesn't exist
      const textCapture = {
        captureId: 'text-cap',
        userId: 'user-1',
        type: 'TEXT',
        state: 'ready',
      };

      await service.publishJob(textCapture);

      const payload = mockRabbitMQClient.emit.mock.calls[0][1];
      expect(payload.contentType).toBe('text');
    });

    it('should include queuedAt timestamp', async () => {
      // RED: Will fail - timestamp logic doesn't exist
      const capture = {
        captureId: 'cap-1',
        userId: 'user-1',
        type: 'TEXT',
        state: 'ready',
      };

      const beforePublish = new Date();
      await service.publishJob(capture);
      const afterPublish = new Date();

      const payload = mockRabbitMQClient.emit.mock.calls[0][1];
      expect(payload.queuedAt).toBeInstanceOf(Date);
      expect(payload.queuedAt.getTime()).toBeGreaterThanOrEqual(beforePublish.getTime());
      expect(payload.queuedAt.getTime()).toBeLessThanOrEqual(afterPublish.getTime());
    });

    it('should initialize retryCount to 0', async () => {
      // RED: Will fail - retryCount doesn't exist
      const capture = {
        captureId: 'cap-1',
        userId: 'user-1',
        type: 'TEXT',
        state: 'ready',
      };

      await service.publishJob(capture);

      const payload = mockRabbitMQClient.emit.mock.calls[0][1];
      expect(payload.retryCount).toBe(0);
    });

    it('should throw error if RabbitMQ publish fails', async () => {
      // RED: Will fail - error handling doesn't exist
      mockRabbitMQClient.emit.mockReturnValue(
        throwError(() => new Error('RabbitMQ connection failed')),
      );

      const capture = {
        captureId: 'cap-fail',
        userId: 'user-1',
        type: 'TEXT',
        state: 'ready',
      };

      await expect(service.publishJob(capture)).rejects.toThrow();
    });
  });

  describe('publishJobForTextCapture', () => {
    it('should bypass transcription for text captures', async () => {
      // RED: Will fail - method doesn't exist
      const textCapture = {
        captureId: 'text-only',
        userId: 'user-1',
        type: 'TEXT',
        text: 'Direct text input',
      };

      await service.publishJobForTextCapture(textCapture);

      expect(mockRabbitMQClient.emit).toHaveBeenCalledWith(
        'digestion.job.queued',
        expect.objectContaining({
          captureId: 'text-only',
          contentType: 'text',
        }),
      );
    });
  });
});
