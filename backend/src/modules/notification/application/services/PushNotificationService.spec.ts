/**
 * Push Notification Service Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 5, Subtask 5.7: Add unit tests for PushNotificationService
 */

import 'reflect-metadata';
import { PushNotificationService } from './PushNotificationService';
import { Expo } from 'expo-server-sdk';

// Mock expo-server-sdk
jest.mock('expo-server-sdk');

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let mockExpo: jest.Mocked<Expo>;

  beforeEach(() => {
    // Create mock Expo instance
    mockExpo = {
      isExpoPushToken: jest.fn(),
      sendPushNotificationsAsync: jest.fn(),
      chunkPushNotifications: jest.fn((messages) => [messages]), // Default: single chunk
      chunkPushNotificationReceiptIds: jest.fn((ids) => [ids]),
      getPushNotificationReceiptsAsync: jest.fn(),
    } as any;

    // Mock Expo constructor
    (Expo as unknown as jest.Mock).mockImplementation(() => mockExpo);

    // Mock static method
    (Expo.isExpoPushToken as jest.Mock) = mockExpo.isExpoPushToken;

    service = new PushNotificationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidPushToken', () => {
    it('should validate Expo push token', () => {
      mockExpo.isExpoPushToken.mockReturnValue(true);

      const result = service.isValidPushToken('ExponentPushToken[xxxxxx]');

      expect(result).toBe(true);
      expect(mockExpo.isExpoPushToken).toHaveBeenCalledWith('ExponentPushToken[xxxxxx]');
    });

    it('should reject invalid push token', () => {
      mockExpo.isExpoPushToken.mockReturnValue(false);

      const result = service.isValidPushToken('invalid-token');

      expect(result).toBe(false);
    });
  });

  describe('sendDigestionCompleteNotification (AC3)', () => {
    it('should send push notification successfully', async () => {
      mockExpo.isExpoPushToken.mockReturnValue(true);
      mockExpo.sendPushNotificationsAsync.mockResolvedValue([
        {
          status: 'ok',
          id: 'ticket-123',
        },
      ]);

      const result = await service.sendDigestionCompleteNotification(
        'user-456',
        'ExponentPushToken[xxxxxx]',
        'capture-789',
        'Test summary',
        3,
        2,
      );

      expect(result.success).toBe(true);
      expect(result.ticketId).toBe('ticket-123');
      expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            to: 'ExponentPushToken[xxxxxx]',
            title: '✨ New insights from your thought!',
            body: expect.stringContaining('3 ideas, 2 actions'),
            data: expect.objectContaining({
              captureId: 'capture-789',
              type: 'completed',
            }),
          }),
        ]),
      );
    });

    it('should truncate summary preview to 50 chars (NFR12)', async () => {
      mockExpo.isExpoPushToken.mockReturnValue(true);
      mockExpo.sendPushNotificationsAsync.mockResolvedValue([
        {
          status: 'ok',
          id: 'ticket-123',
        },
      ]);

      const longSummary = 'A'.repeat(100); // 100 chars
      await service.sendDigestionCompleteNotification(
        'user-456',
        'ExponentPushToken[xxxxxx]',
        'capture-789',
        longSummary,
        2,
        1,
      );

      const callArgs = (mockExpo.sendPushNotificationsAsync as jest.Mock).mock.calls[0][0][0];
      const bodyText = callArgs.body;

      // Should be truncated to ~50 chars + "..."
      expect(bodyText).toContain('...');
      expect(bodyText.length).toBeLessThan(100);
    });

    it('should return error for invalid push token', async () => {
      mockExpo.isExpoPushToken.mockReturnValue(false);

      const result = await service.sendDigestionCompleteNotification(
        'user-456',
        'invalid-token',
        'capture-789',
        'Test summary',
        3,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Expo push token');
      expect(mockExpo.sendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('should handle Expo send error', async () => {
      mockExpo.isExpoPushToken.mockReturnValue(true);
      mockExpo.sendPushNotificationsAsync.mockResolvedValue([
        {
          status: 'error',
          message: 'DeviceNotRegistered',
        },
      ]);

      const result = await service.sendDigestionCompleteNotification(
        'user-456',
        'ExponentPushToken[xxxxxx]',
        'capture-789',
        'Test summary',
        3,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('DeviceNotRegistered');
    });

    it('should handle network errors gracefully', async () => {
      mockExpo.isExpoPushToken.mockReturnValue(true);
      mockExpo.sendPushNotificationsAsync.mockRejectedValue(new Error('Network error'));

      const result = await service.sendDigestionCompleteNotification(
        'user-456',
        'ExponentPushToken[xxxxxx]',
        'capture-789',
        'Test summary',
        3,
        2,
      );

      expect(result.success).toBe(false);
      // When sendPushNotifications catches error and returns empty array,
      // we get "No tickets returned from Expo" error
      expect(result.error).toBe('No tickets returned from Expo');
    });
  });

  describe('sendPushNotifications (Subtask 5.5: Batching)', () => {
    it('should chunk messages into batches of 100', async () => {
      const messages = new Array(250).fill({
        to: 'ExponentPushToken[xxxxxx]',
        body: 'Test',
      });

      mockExpo.chunkPushNotifications.mockReturnValue([
        messages.slice(0, 100),
        messages.slice(100, 200),
        messages.slice(200, 250),
      ]);

      mockExpo.sendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok', id: 'ticket-1' },
      ]);

      const tickets = await service.sendPushNotifications(messages);

      expect(mockExpo.chunkPushNotifications).toHaveBeenCalledWith(messages);
      expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledTimes(3);
      expect(tickets.length).toBe(3);
    });

    it('should continue with next batch if one fails', async () => {
      const messages = [
        { to: 'token1', body: 'Test 1' },
        { to: 'token2', body: 'Test 2' },
      ];

      mockExpo.chunkPushNotifications.mockReturnValue([[messages[0]], [messages[1]]]);

      // First batch fails, second succeeds
      mockExpo.sendPushNotificationsAsync
        .mockRejectedValueOnce(new Error('Batch 1 failed'))
        .mockResolvedValueOnce([{ status: 'ok', id: 'ticket-2' }]);

      const tickets = await service.sendPushNotifications(messages);

      expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledTimes(2);
      expect(tickets.length).toBe(1); // Only second batch succeeded
      expect(tickets[0].id).toBe('ticket-2');
    });

    it('should return empty array if all batches fail', async () => {
      const messages = [{ to: 'token1', body: 'Test' }];

      mockExpo.chunkPushNotifications.mockReturnValue([messages]);
      mockExpo.sendPushNotificationsAsync.mockRejectedValue(new Error('All failed'));

      const tickets = await service.sendPushNotifications(messages);

      expect(tickets).toEqual([]);
    });
  });

  describe('checkPushNotificationReceipts (Subtask 5.6)', () => {
    it('should fetch and process receipts', async () => {
      const ticketIds = ['ticket-1', 'ticket-2'];

      mockExpo.chunkPushNotificationReceiptIds.mockReturnValue([ticketIds]);
      mockExpo.getPushNotificationReceiptsAsync.mockResolvedValue({
        'ticket-1': { status: 'ok' },
        'ticket-2': { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } },
      });

      const receipts = await service.checkPushNotificationReceipts(ticketIds);

      expect(receipts.size).toBe(2);
      expect(receipts.get('ticket-1')).toEqual({ status: 'ok' });
      expect(receipts.get('ticket-2')).toEqual({
        status: 'error',
        message: 'DeviceNotRegistered',
        details: { error: 'DeviceNotRegistered' },
      });
    });

    it('should handle DeviceNotRegistered errors', async () => {
      const ticketIds = ['ticket-1'];

      mockExpo.chunkPushNotificationReceiptIds.mockReturnValue([ticketIds]);
      mockExpo.getPushNotificationReceiptsAsync.mockResolvedValue({
        'ticket-1': {
          status: 'error',
          message: 'DeviceNotRegistered',
          details: { error: 'DeviceNotRegistered' },
        },
      });

      const receipts = await service.checkPushNotificationReceipts(ticketIds);

      expect(receipts.get('ticket-1')?.status).toBe('error');
      expect(receipts.get('ticket-1')?.details?.error).toBe('DeviceNotRegistered');
    });

    it('should handle network errors gracefully', async () => {
      const ticketIds = ['ticket-1'];

      mockExpo.chunkPushNotificationReceiptIds.mockReturnValue([ticketIds]);
      mockExpo.getPushNotificationReceiptsAsync.mockRejectedValue(new Error('Network error'));

      const receipts = await service.checkPushNotificationReceipts(ticketIds);

      expect(receipts.size).toBe(0);
    });
  });

  describe('sendErrorNotification (AC5)', () => {
    it('should send error notification with retry action', async () => {
      mockExpo.isExpoPushToken.mockReturnValue(true);
      mockExpo.sendPushNotificationsAsync.mockResolvedValue([
        {
          status: 'ok',
          id: 'ticket-123',
        },
      ]);

      const result = await service.sendErrorNotification(
        'user-456',
        'ExponentPushToken[xxxxxx]',
        'capture-789',
        3,
      );

      expect(result.success).toBe(true);
      expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title: '❌ Unable to process thought',
            body: 'Tap to retry',
            data: expect.objectContaining({
              captureId: 'capture-789',
              type: 'failed',
              action: 'retry',
            }),
          }),
        ]),
      );
    });

    it('should return error for invalid push token', async () => {
      mockExpo.isExpoPushToken.mockReturnValue(false);

      const result = await service.sendErrorNotification(
        'user-456',
        'invalid-token',
        'capture-789',
        3,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Expo push token');
    });
  });
});
