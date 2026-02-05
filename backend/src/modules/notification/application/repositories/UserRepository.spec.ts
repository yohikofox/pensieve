/**
 * User Repository Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 5, Subtask 5.3 & Task 6, Subtask 6.2
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRepository } from './UserRepository';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockTypeOrmRepository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    mockTypeOrmRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: getRepositoryToken(User),
          useValue: mockTypeOrmRepository,
        },
      ],
    }).compile();

    userRepository = module.get<UserRepository>(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updatePushToken', () => {
    it('should update user push token', async () => {
      const userId = 'user-123';
      const pushToken = 'ExponentPushToken[xxxxxx]';

      await userRepository.updatePushToken(userId, pushToken);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(userId, {
        pushToken,
      });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update all notification preferences', async () => {
      const userId = 'user-123';
      const preferences = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: false,
      };

      await userRepository.updateNotificationPreferences(userId, preferences);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(userId, preferences);
    });

    it('should update partial notification preferences', async () => {
      const userId = 'user-123';
      const preferences = {
        pushNotificationsEnabled: false,
      };

      await userRepository.updateNotificationPreferences(userId, preferences);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(userId, preferences);
    });
  });

  describe('getUserNotificationSettings', () => {
    it('should return user notification settings', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        pushToken: 'ExponentPushToken[xxxxxx]',
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
      };

      mockTypeOrmRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await userRepository.getUserNotificationSettings(userId);

      expect(result).toEqual({
        pushToken: 'ExponentPushToken[xxxxxx]',
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
      });
      expect(mockTypeOrmRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        select: [
          'id',
          'pushToken',
          'pushNotificationsEnabled',
          'localNotificationsEnabled',
          'hapticFeedbackEnabled',
        ],
      });
    });

    it('should return null if user not found', async () => {
      const userId = 'non-existent-user';
      mockTypeOrmRepository.findOne.mockResolvedValue(null);

      const result = await userRepository.getUserNotificationSettings(userId);

      expect(result).toBeNull();
    });

    it('should handle user without push token', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        pushToken: undefined,
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: false,
      };

      mockTypeOrmRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await userRepository.getUserNotificationSettings(userId);

      expect(result).toEqual({
        pushToken: undefined,
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: false,
      });
    });
  });
});
