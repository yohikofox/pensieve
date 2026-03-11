// Jest mock for 'expo-server-sdk' (ESM → CJS stub for unit tests)
'use strict';

class Expo {
  static isExpoPushToken() { return true; }
  async sendPushNotificationsAsync() { return []; }
  async getPushNotificationReceiptsAsync() { return {}; }
  chunkPushNotifications(messages) { return [messages]; }
}

module.exports = { Expo };
