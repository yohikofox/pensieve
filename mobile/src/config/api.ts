/**
 * API Configuration
 *
 * Uses environment variables with fallback to localhost
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const apiConfig = {
  baseUrl: API_URL,
  endpoints: {
    rgpd: {
      export: `${API_URL}/api/rgpd/export`,
      deleteAccount: `${API_URL}/api/rgpd/delete-account`,
    },
    auth: {
      me: `${API_URL}/api/auth/me`,
      health: `${API_URL}/api/auth/health`,
    },
    users: {
      pushToken: `${API_URL}/api/users/push-token`,
      notificationSettings: `${API_URL}/api/users/notification-settings`,
    },
  },
  google: {
    // Google OAuth Client ID for calendar integration
    // Create at: https://console.cloud.google.com/apis/credentials
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
  },
};
