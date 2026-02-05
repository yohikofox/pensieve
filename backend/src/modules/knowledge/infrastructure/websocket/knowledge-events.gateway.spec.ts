/**
 * KnowledgeEventsGateway Unit Tests
 * Tests for Story 4.2 Task 6.1 + Story 4.4 Task 3
 *
 * Covers:
 * - Story 4.2, AC5: Real-Time Feed Update Notification
 * - Story 4.4, AC2: Active Processing Indicator
 * - Story 4.4, AC6: Multi-Capture Progress Tracking
 * - Story 4.4, AC9: Timeout Warning Notification
 */

import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeEventsGateway } from './knowledge-events.gateway';
import type { DomainEvent } from '../../application/services/event-bus.service';
import type { Server, Socket } from 'socket.io';

describe('KnowledgeEventsGateway (Task 6.1)', () => {
  let gateway: KnowledgeEventsGateway;
  let mockServer: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(async () => {
    // Mock Socket.IO Server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    // Mock Socket.IO Socket
    mockSocket = {
      id: 'test-socket-id',
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [KnowledgeEventsGateway],
    }).compile();

    gateway = module.get<KnowledgeEventsGateway>(KnowledgeEventsGateway);

    // Inject mock server
    gateway['server'] = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Gateway Initialization (Subtask 6.1)', () => {
    it('should initialize server reference', () => {
      // Act
      gateway.afterInit(mockServer);

      // Assert
      expect(gateway['server']).toBe(mockServer);
    });

    it('should log initialization message', () => {
      // Arrange
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      // Act
      gateway.afterInit(mockServer);

      // Assert
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket Gateway initialized'),
      );
    });
  });

  describe('Client Connection Management (Subtask 6.1)', () => {
    it('should allow client to join user-specific room', async () => {
      // Arrange
      const userId = 'user-123';

      // Act
      await gateway.handleJoinRoom(mockSocket, userId);

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith(`user:${userId}`);
    });

    it('should store userId in socket data for later use', async () => {
      // Arrange
      const userId = 'user-456';

      // Act
      await gateway.handleJoinRoom(mockSocket, userId);

      // Assert
      expect(mockSocket.data.userId).toBe(userId);
    });

    it('should handle client disconnection gracefully', () => {
      // Arrange
      mockSocket.data.userId = 'user-789';

      // Act
      gateway.handleDisconnect(mockSocket);

      // Assert - Should log disconnect (no errors)
      expect(mockSocket.data.userId).toBe('user-789');
    });
  });

  describe('Digestion Completed Event Broadcasting (AC5)', () => {
    it('should broadcast digestion.completed event to user room', () => {
      // Arrange
      const domainEvent: DomainEvent = {
        eventName: 'digestion.completed',
        occurredAt: new Date(),
        payload: {
          thoughtId: 'thought-123',
          captureId: 'capture-456',
          userId: 'user-789',
          summary: 'Test summary',
          ideasCount: 3,
          processingTimeMs: 1500,
          completedAt: new Date().toISOString(),
        },
      };

      // Act
      gateway.handleDigestionCompleted(domainEvent);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:user-789');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'digestion.completed',
        expect.objectContaining({
          thoughtId: 'thought-123',
          captureId: 'capture-456',
          userId: 'user-789',
          summaryPreview: expect.stringContaining('Test summary'), // NFR12: preview only
          ideasCount: 3,
        }),
      );
    });

    it('should include all required fields in the event payload', () => {
      // Arrange
      const domainEvent: DomainEvent = {
        eventName: 'digestion.completed',
        occurredAt: new Date(),
        payload: {
          thoughtId: 'thought-abc',
          captureId: 'capture-def',
          userId: 'user-xyz',
          summary: 'Summary text',
          ideasCount: 5,
          processingTimeMs: 2000,
          completedAt: '2026-02-04T12:00:00Z',
        },
      };

      // Act
      gateway.handleDigestionCompleted(domainEvent);

      // Assert - Verify all fields are present
      const emitCall = (mockServer.emit as jest.Mock).mock.calls[0];
      const payload = emitCall[1];

      expect(payload).toHaveProperty('thoughtId', 'thought-abc');
      expect(payload).toHaveProperty('captureId', 'capture-def');
      expect(payload).toHaveProperty('userId', 'user-xyz');
      expect(payload).toHaveProperty('summaryPreview'); // NFR12: preview only, not full summary
      expect(payload.summaryPreview).toContain('Summary text');
      expect(payload).toHaveProperty('ideasCount', 5);
      expect(payload).toHaveProperty('processingTimeMs', 2000);
      expect(payload).toHaveProperty('completedAt', '2026-02-04T12:00:00Z');
    });

    it('should only notify the specific user (not broadcast to all)', () => {
      // Arrange
      const event1: DomainEvent = {
        eventName: 'digestion.completed',
        occurredAt: new Date(),
        payload: {
          thoughtId: 'thought-1',
          captureId: 'capture-1',
          userId: 'user-A',
          summary: 'Summary A',
          ideasCount: 1,
          processingTimeMs: 1000,
          completedAt: new Date().toISOString(),
        },
      };

      const event2: DomainEvent = {
        eventName: 'digestion.completed',
        occurredAt: new Date(),
        payload: {
          thoughtId: 'thought-2',
          captureId: 'capture-2',
          userId: 'user-B',
          summary: 'Summary B',
          ideasCount: 2,
          processingTimeMs: 1500,
          completedAt: new Date().toISOString(),
        },
      };

      // Act
      gateway.handleDigestionCompleted(event1);
      gateway.handleDigestionCompleted(event2);

      // Assert - Each event goes to specific user room
      expect(mockServer.to).toHaveBeenCalledWith('user:user-A');
      expect(mockServer.to).toHaveBeenCalledWith('user:user-B');
      expect(mockServer.to).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling (Subtask 6.1)', () => {
    it('should handle missing userId in event gracefully', () => {
      // Arrange
      const malformedEvent: DomainEvent = {
        eventName: 'digestion.completed',
        occurredAt: new Date(),
        payload: {
          thoughtId: 'thought-123',
          captureId: 'capture-456',
          // userId missing
          summary: 'Test',
          ideasCount: 1,
        },
      };

      // Act & Assert - Should not throw
      expect(() => gateway.handleDigestionCompleted(malformedEvent)).not.toThrow();
    });

    it('should handle server not initialized', () => {
      // Arrange
      gateway['server'] = undefined as any;
      const event: DomainEvent = {
        eventName: 'digestion.completed',
        occurredAt: new Date(),
        payload: {
          thoughtId: 'thought-123',
          captureId: 'capture-456',
          userId: 'user-789',
          summary: 'Test',
          ideasCount: 1,
          processingTimeMs: 1000,
          completedAt: new Date().toISOString(),
        },
      };

      // Act & Assert - Should not throw
      expect(() => gateway.handleDigestionCompleted(event)).not.toThrow();
    });
  });

  describe('Progress Update Event Broadcasting (Story 4.4, AC2, AC6)', () => {
    beforeEach(() => {
      gateway['server'] = mockServer;
    });

    it('should broadcast progress.update event to user room', () => {
      // Arrange
      const progressEvent = {
        captureId: 'capture-123',
        userId: 'user-456',
        status: 'processing',
        elapsed: 5000,
        queuePosition: undefined,
        estimatedRemaining: 10000,
        timestamp: new Date(),
      };

      // Act
      gateway.handleProgressUpdate(progressEvent);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:user-456');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'progress.update',
        expect.objectContaining({
          captureId: 'capture-123',
          status: 'processing',
          elapsed: 5000,
        }),
      );
    });

    it('should include queue position for queued jobs (AC1)', () => {
      // Arrange
      const queuedEvent = {
        captureId: 'capture-123',
        userId: 'user-456',
        status: 'queued',
        elapsed: 0,
        queuePosition: 3,
        estimatedRemaining: 60000,
        timestamp: new Date(),
      };

      // Act
      gateway.handleProgressUpdate(queuedEvent);

      // Assert
      const emitCall = (mockServer.emit as jest.Mock).mock.calls[0];
      const payload = emitCall[1];
      expect(payload.queuePosition).toBe(3);
      expect(payload.estimatedRemaining).toBe(60000);
    });

    it('should handle missing userId gracefully', () => {
      // Arrange
      const malformedEvent = {
        captureId: 'capture-123',
        // userId missing
        status: 'processing',
        elapsed: 5000,
      };

      // Act & Assert - Should not throw
      expect(() => gateway.handleProgressUpdate(malformedEvent)).not.toThrow();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('Still Processing Event Broadcasting (Story 4.4, AC2)', () => {
    beforeEach(() => {
      gateway['server'] = mockServer;
    });

    it('should broadcast progress.still-processing event after 10s', () => {
      // Arrange
      const stillProcessingEvent = {
        captureId: 'capture-123',
        userId: 'user-456',
        elapsed: 12000,
        timestamp: new Date(),
      };

      // Act
      gateway.handleStillProcessing(stillProcessingEvent);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:user-456');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'progress.still-processing',
        expect.objectContaining({
          captureId: 'capture-123',
          elapsed: 12000,
        }),
      );
    });

    it('should handle missing userId gracefully', () => {
      // Arrange
      const malformedEvent = {
        captureId: 'capture-123',
        elapsed: 12000,
      };

      // Act & Assert - Should not throw
      expect(() => gateway.handleStillProcessing(malformedEvent)).not.toThrow();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('Timeout Warning Event Broadcasting (Story 4.4, AC9)', () => {
    beforeEach(() => {
      gateway['server'] = mockServer;
    });

    it('should broadcast progress.timeout-warning after 30s', () => {
      // Arrange
      const timeoutEvent = {
        captureId: 'capture-123',
        userId: 'user-456',
        elapsed: 32000,
        threshold: 30000,
        timestamp: new Date(),
      };

      // Act
      gateway.handleTimeoutWarning(timeoutEvent);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:user-456');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'progress.timeout-warning',
        expect.objectContaining({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
        }),
      );
    });

    it('should handle missing userId gracefully', () => {
      // Arrange
      const malformedEvent = {
        captureId: 'capture-123',
        elapsed: 32000,
        threshold: 30000,
      };

      // Act & Assert - Should not throw
      expect(() => gateway.handleTimeoutWarning(malformedEvent)).not.toThrow();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });
});
