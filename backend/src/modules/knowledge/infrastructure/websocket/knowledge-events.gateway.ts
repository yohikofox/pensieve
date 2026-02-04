/**
 * Knowledge Events WebSocket Gateway
 * Real-time notification system for digestion completion events
 *
 * Covers:
 * - Task 6, Subtask 6.1: WebSocket event handler for digestion.completed
 * - AC5: Real-Time Feed Update Notification
 *
 * Pattern:
 * - Clients join user-specific rooms (user:{userId})
 * - Digestion completed events are broadcast only to the relevant user
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
    origin: '*', // TODO: Configure for production (restrict to mobile app)
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
    this.server.to(roomName).emit('digestion.completed', {
      thoughtId: payload.thoughtId,
      captureId: payload.captureId,
      userId: payload.userId,
      summary: payload.summary,
      ideasCount: payload.ideasCount,
      processingTimeMs: payload.processingTimeMs,
      completedAt: payload.completedAt,
    });
  }
}
