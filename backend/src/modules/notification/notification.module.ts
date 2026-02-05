/**
 * Notification Context Module
 * Bounded Context for Progress Notifications (Story 4.4)
 *
 * Responsibilities:
 * - Progress notification service
 * - Push notification service
 * - Notification repository
 * - User notification preferences
 */

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Notification } from './domain/entities/Notification.entity';
import { User } from '../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { ProgressNotificationService } from './application/services/ProgressNotificationService';
import { PushNotificationService } from './application/services/PushNotificationService';
import { NotificationRepository } from './application/repositories/NotificationRepository';
import { UserRepository } from './application/repositories/UserRepository';
import { DigestionCompletedListener } from './application/listeners/DigestionCompletedListener';
import { DigestionFailedListener } from './application/listeners/DigestionFailedListener';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    // Register TypeORM entities for Notification Context
    TypeOrmModule.forFeature([Notification, User]),
    // Event emitter for domain events
    EventEmitterModule.forRoot(),
    // Import KnowledgeModule for ProgressTrackerService (forward ref to avoid circular dependency)
    forwardRef(() => KnowledgeModule),
  ],
  providers: [
    ProgressNotificationService,
    PushNotificationService,
    NotificationRepository,
    UserRepository,
    // Event listeners for digestion events (AC3, AC5)
    DigestionCompletedListener,
    DigestionFailedListener,
  ],
  exports: [
    ProgressNotificationService,
    PushNotificationService,
    NotificationRepository,
    UserRepository,
  ],
})
export class NotificationModule {}
