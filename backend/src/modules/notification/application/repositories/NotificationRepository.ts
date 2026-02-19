/**
 * Notification Repository Implementation
 * TypeORM-based persistence for Notification entities
 *
 * Story 4.4: Notifications de Progression IA
 * Task 1, Subtask 1.4: Create NotificationRepository with CRUD operations
 *
 * Following DDD patterns established in Knowledge Context
 * Uses NestJS DI
 */

import { Injectable } from '@nestjs/common';
import { DataSource, Repository, LessThan } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import {
  Notification,
  DeliveryStatus,
} from '../../domain/entities/Notification.entity';
import { INotificationRepository } from '../../domain/interfaces/INotificationRepository';

@Injectable()
export class NotificationRepository implements INotificationRepository {
  private repository: Repository<Notification>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Notification);
  }

  async create(notification: Notification): Promise<Notification> {
    // ADR-026 R1: UUID généré dans la couche domaine (pas par PostgreSQL DEFAULT)
    if (!notification.id) {
      notification.id = uuidv7();
    }
    const savedNotification = await this.repository.save(notification);
    return savedNotification;
  }

  async findById(id: string): Promise<Notification | null> {
    const notification = await this.repository.findOne({
      where: { id },
    });
    return notification;
  }

  async findByUserId(
    userId: string,
    limit: number = 50,
  ): Promise<Notification[]> {
    const notifications = await this.repository.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return notifications;
  }

  async findByRelatedEntity(
    relatedEntityId: string,
    relatedEntityType: string,
  ): Promise<Notification[]> {
    const notifications = await this.repository.find({
      where: {
        relatedEntityId,
        relatedEntityType,
      },
      order: { createdAt: 'DESC' },
    });
    return notifications;
  }

  async updateDeliveryStatus(
    id: string,
    status: 'scheduled' | 'sent' | 'delivered' | 'failed',
    timestamp?: Date,
  ): Promise<void> {
    const updateData: any = {
      deliveryStatus: status,
    };

    if (status === 'sent' && timestamp) {
      updateData.sentAt = timestamp;
    } else if (status === 'delivered' && timestamp) {
      updateData.deliveredAt = timestamp;
    }

    await this.repository.update(id, updateData);
  }

  async deleteOldNotifications(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.repository.delete({ // ADR-026 exception: purge opérationnelle RGPD — suppression physique intentionnelle des vieilles notifications (archivage > X jours, pas de valeur audit)
      createdAt: LessThan(cutoffDate),
    });

    return result.affected ?? 0;
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    // For MVP, "unread" = not delivered yet
    // Future enhancement: add 'read' field to Notification entity
    const count = await this.repository.count({
      where: {
        ownerId: userId,
        deliveryStatus: DeliveryStatus.SENT,
      },
    });
    return count;
  }
}
