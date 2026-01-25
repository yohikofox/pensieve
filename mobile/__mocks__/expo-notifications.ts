/**
 * Mock for expo-notifications
 *
 * Used in Jest tests to avoid native module errors
 */

export const setNotificationHandler = jest.fn();

export const getPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  expires: 'never',
  canAskAgain: true,
  granted: true,
});

export const requestPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  expires: 'never',
  canAskAgain: true,
  granted: true,
});

export const scheduleNotificationAsync = jest.fn().mockResolvedValue('mock-notification-id');

export const addNotificationResponseReceivedListener = jest.fn().mockReturnValue({
  remove: jest.fn(),
});

export const addNotificationReceivedListener = jest.fn().mockReturnValue({
  remove: jest.fn(),
});

export const cancelAllScheduledNotificationsAsync = jest.fn().mockResolvedValue(undefined);

export const cancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);

export const getBadgeCountAsync = jest.fn().mockResolvedValue(0);

export const setBadgeCountAsync = jest.fn().mockResolvedValue(true);
