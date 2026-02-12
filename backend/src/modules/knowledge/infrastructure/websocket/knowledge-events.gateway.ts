/**
 * Knowledge Events WebSocket Gateway
 * Real-time notification system for digestion completion and progress events
 *
 * Covers:
 * - Story 4.2, Task 6, Subtask 6.1: WebSocket event handler for digestion.completed
 * - Story 4.2, AC5: Real-Time Feed Update Notification
 * - Story 4.4, Task 3: WebSocket Real-Time Progress Updates
 * - Story 4.4, AC2: Active Processing Indicator
 * - Story 4.4, AC6: Multi-Capture Progress Tracking
 * - Story 4.4, AC9: Timeout Warning Notification
 *
 * Pattern:
 * - Clients join user-specific rooms (user:{userId})
 * - Events are broadcast only to the relevant user (NFR13)
 * - Mobile app receives immediate notifications for feed updates
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import type { DomainEvent } from '../../application/services/event-bus.service';

interface DigestionCompletedPayload {
  thoughtId: string;
  captureId: string;
  userId: string;
  summary: string;
  ideasCount: number;
  processingTimeMs: number;
  completedAt: string;
}

@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? [process.env.MOBILE_APP_URL || 'https://app.pensieve.io']
        : ['http://localhost:8081', 'exp://localhost:8081'], // Expo dev URLs
    credentials: true,
  },
  namespace: '/knowledge',
})
export class KnowledgeEventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server; // Non-null assertion: initialized by @WebSocketServer

  private readonly logger = new Logger(KnowledgeEventsGateway.name);

  /**
   * Initialize gateway
   * Subtask 6.1: Gateway initialization
   */
  afterInit(server: Server): void {
    this.server = server;
    this.logger.log('🔌 Knowledge Events WebSocket Gateway initialized');
    this.logger.log('📡 Listening for digestion.completed events via @OnEvent');
  }

  /**
   * Handle new client connections
   */
  handleConnection(@ConnectedSocket() client: Socket): void {
    this.logger.log(`✅ Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnections
   */
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const userId = client.data.userId;
    this.logger.log(
      `❌ Client disconnected: ${client.id}${userId ? ` (user: ${userId})` : ''}`,
    );
  }

  /**
   * Handle client joining user-specific room
   * Subtask 6.1: Room management for user-specific notifications
   *
   * Mobile app calls this on connect with userId to receive their notifications
   */
  @SubscribeMessage('join-user-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: string,
  ): Promise<void> {
    const roomName = `user:${userId}`;
    await client.join(roomName);
    client.data.userId = userId;

    this.logger.log(`👤 Client ${client.id} joined room: ${roomName}`);
  }

  /**
   * Broadcast digestion completed event to specific user
   * AC5: Real-Time Feed Update Notification
   *
   * This is called by NestJS EventEmitter when DigestionJobConsumer
   * publishes a digestion.completed event
   *
   * @param event - Domain event with digestion completed payload
   */
  @OnEvent('digestion.completed')
  handleDigestionCompleted(event: DomainEvent): void {
    const payload = event.payload as DigestionCompletedPayload;
    // Validate event has required fields
    if (!payload.userId) {
      this.logger.warn('⚠️  Received digestion.completed event without userId');
      return;
    }

    if (!this.server) {
      this.logger.warn('⚠️  Server not initialized, cannot broadcast event');
      return;
    }

    const roomName = `user:${payload.userId}`;

    this.logger.log(
      `📤 Broadcasting digestion.completed to ${roomName}: thought=${payload.thoughtId}, capture=${payload.captureId}`,
    );

    // Broadcast only to the user's room (not to all clients)
    // Note: Send minimal data - mobile will fetch full Thought via API
    // This reduces sensitive data exposure over WebSocket (NFR12 compliance)
    this.server.to(roomName).emit('digestion.completed', {
      thoughtId: payload.thoughtId,
      captureId: payload.captureId,
      userId: payload.userId,
      summaryPreview: payload.summary.substring(0, 100) + '...', // Preview only
      ideasCount: payload.ideasCount,
      processingTimeMs: payload.processingTimeMs,
      completedAt: payload.completedAt,
    });
  }

  /**
   * Broadcast progress update to specific user
   * Story 4.4, Task 3, Subtask 3.1-3.4: WebSocket progress updates
   * AC2: Active Processing Indicator
   * AC6: Multi-Capture Progress Tracking
   *
   * This is called by ProgressNotificationService when progress changes
   *
   * @param event - Progress update event
   */
  @OnEvent('progress.update')
  handleProgressUpdate(event: any): void {
    if (!event.userId) {
      this.logger.warn('⚠️  Received progress.update event without userId');
      return;
    }

    if (!this.server) {
      this.logger.warn('⚠️  Server not initialized, cannot broadcast event');
      return;
    }

    const roomName = `user:${event.userId}`;

    this.logger.debug(
      `📈 Broadcasting progress.update to ${roomName}: capture=${event.captureId}, status=${event.status}, elapsed=${event.elapsed}ms`,
    );

    // Broadcast progress update to user-specific room
    this.server.to(roomName).emit('progress.update', {
      captureId: event.captureId,
      status: event.status,
      elapsed: event.elapsed,
      queuePosition: event.queuePosition,
      estimatedRemaining: event.estimatedRemaining,
      timestamp: event.timestamp,
    });
  }

  /**
   * Broadcast "Still processing..." notification
   * AC2: Still processing notification after 10s
   *
   * @param event - Progress update event with elapsed > 10s
   */
  @OnEvent('progress.still-processing')
  handleStillProcessing(event: any): void {
    if (!event.userId) {
      this.logger.warn(
        '⚠️  Received progress.still-processing event without userId',
      );
      return;
    }

    if (!this.server) {
      this.logger.warn('⚠️  Server not initialized, cannot broadcast event');
      return;
    }

    const roomName = `user:${event.userId}`;

    this.logger.debug(
      `⏳ Broadcasting progress.still-processing to ${roomName}: capture=${event.captureId}, elapsed=${event.elapsed}ms`,
    );

    this.server.to(roomName).emit('progress.still-processing', {
      captureId: event.captureId,
      elapsed: event.elapsed,
      timestamp: event.timestamp,
    });
  }

  /**
   * Broadcast timeout warning to specific user
   * AC9: Timeout Warning Notification
   *
   * @param event - Timeout warning event
   */
  @OnEvent('progress.timeout-warning')
  handleTimeoutWarning(event: any): void {
    if (!event.userId) {
      this.logger.warn(
        '⚠️  Received progress.timeout-warning event without userId',
      );
      return;
    }

    if (!this.server) {
      this.logger.warn('⚠️  Server not initialized, cannot broadcast event');
      return;
    }

    const roomName = `user:${event.userId}`;

    this.logger.warn(
      `⚠️  Broadcasting progress.timeout-warning to ${roomName}: capture=${event.captureId}, elapsed=${event.elapsed}ms`,
    );

    this.server.to(roomName).emit('progress.timeout-warning', {
      captureId: event.captureId,
      elapsed: event.elapsed,
      threshold: event.threshold,
      timestamp: event.timestamp,
    });
  }
}
