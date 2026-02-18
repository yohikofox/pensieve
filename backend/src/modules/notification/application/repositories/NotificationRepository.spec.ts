/**
 * Notification Repository Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 1, Subtask 1.5: Add unit tests for NotificationRepository
 */

import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { NotificationRepository } from './NotificationRepository';
import {
  Notification,
  NotificationType,
  DeliveryStatus,
  DeliveryMethod,
} from '../../domain/entities/Notification.entity';

describe('NotificationRepository', () => {
  let repository: NotificationRepository;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockRepository: jest.Mocked<Repository<Notification>>;

  beforeEach(() => {
    // Create mock TypeORM repository
    mockRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    } as any;

    // Create mock DataSource
    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;

    repository = new NotificationRepository(mockDataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new notification', async () => {
      const notification: Notification = {
        id: 'notif-1',
        ownerId: 'user-123',
        type: NotificationType.QUEUED,
        title: 'Processing your thought...',
        body: 'Position in queue: 5',
        data: { captureId: 'capture-123', queuePosition: 5 },
        relatedEntityId: 'capture-123',
        relatedEntityType: 'capture',
        deliveryStatus: DeliveryStatus.SCHEDULED,
        deliveryMethod: DeliveryMethod.LOCAL,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Notification;

      mockRepository.save.mockResolvedValue(notification);

      const result = await repository.create(notification);

      expect(result).toEqual(notification);
      expect(mockRepository.save).toHaveBeenCalledWith(notification);
    });
  });

  describe('findById', () => {
    it('should find notification by ID', async () => {
      const notification: Notification = {
        id: 'notif-1',
        ownerId: 'user-123',
        type: NotificationType.COMPLETED,
      } as Notification;

      mockRepository.findOne.mockResolvedValue(notification);

      const result = await repository.findById('notif-1');

      expect(result).toEqual(notification);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
    });

    it('should return null if notification not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all notifications for a user with default limit', async () => {
      const notifications: Notification[] = [
        { id: 'notif-1', ownerId: 'user-123' } as Notification,
        { id: 'notif-2', ownerId: 'user-123' } as Notification,
      ];

      mockRepository.find.mockResolvedValue(notifications);

      const result = await repository.findByUserId('user-123');

      expect(result).toEqual(notifications);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { ownerId: 'user-123' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('should respect custom limit', async () => {
      const notifications: Notification[] = [];
      mockRepository.find.mockResolvedValue(notifications);

      await repository.findByUserId('user-123', 10);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { ownerId: 'user-123' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('findByRelatedEntity', () => {
    it('should find notifications by related entity', async () => {
      const notifications: Notification[] = [
        {
          id: 'notif-1',
          relatedEntityId: 'capture-123',
          relatedEntityType: 'capture',
        } as Notification,
      ];

      mockRepository.find.mockResolvedValue(notifications);

      const result = await repository.findByRelatedEntity(
        'capture-123',
        'capture',
      );

      expect(result).toEqual(notifications);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          relatedEntityId: 'capture-123',
          relatedEntityType: 'capture',
        },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status to sent with timestamp', async () => {
      const timestamp = new Date();
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      await repository.updateDeliveryStatus('notif-1', 'sent', timestamp);

      expect(mockRepository.update).toHaveBeenCalledWith('notif-1', {
        deliveryStatus: 'sent',
        sentAt: timestamp,
      });
    });

    it('should update delivery status to delivered with timestamp', async () => {
      const timestamp = new Date();
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      await repository.updateDeliveryStatus('notif-1', 'delivered', timestamp);

      expect(mockRepository.update).toHaveBeenCalledWith('notif-1', {
        deliveryStatus: 'delivered',
        deliveredAt: timestamp,
      });
    });

    it('should update delivery status to failed without timestamp', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      await repository.updateDeliveryStatus('notif-1', 'failed');

      expect(mockRepository.update).toHaveBeenCalledWith('notif-1', {
        deliveryStatus: 'failed',
      });
    });
  });

  describe('deleteOldNotifications', () => {
    it('should delete notifications older than specified days', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 5 } as any);

      const result = await repository.deleteOldNotifications(30);

      expect(result).toBe(5);
      expect(mockRepository.delete).toHaveBeenCalledWith({
        createdAt: expect.any(Object), // LessThan matcher
      });
    });

    it('should return 0 if no notifications deleted', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await repository.deleteOldNotifications(30);

      expect(result).toBe(0);
    });

    it('should handle undefined affected count', async () => {
      mockRepository.delete.mockResolvedValue({ affected: undefined } as any);

      const result = await repository.deleteOldNotifications(30);

      expect(result).toBe(0);
    });
  });

  describe('countUnreadByUserId', () => {
    it('should count unread (sent but not delivered) notifications', async () => {
      mockRepository.count.mockResolvedValue(3);

      const result = await repository.countUnreadByUserId('user-123');

      expect(result).toBe(3);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: {
          ownerId: 'user-123',
          deliveryStatus: DeliveryStatus.SENT,
        },
      });
    });

    it('should return 0 if no unread notifications', async () => {
      mockRepository.count.mockResolvedValue(0);

      const result = await repository.countUnreadByUserId('user-123');

      expect(result).toBe(0);
    });
  });
});
