/**
 * Better Auth Client Configuration
 *
 * Story 15.2 — Migration Client Mobile Better Auth
 * ADR-029: AuthTokenManager + stratégie offline
 * ADR-025: fetch natif uniquement (pas axios)
 */

import { createAuthClient } from 'better-auth/client';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_BETTER_AUTH_URL ?? '',
  plugins: [
    expoClient({
      storage: {
        getItem: async (key: string) => SecureStore.getItemAsync(key),
        setItem: async (key: string, value: string) => SecureStore.setItemAsync(key, value),
      },
    }),
  ],
  fetchOptions: {
    headers: {
      // Permet au serveur de retourner tokenExpiresIn (fin du jour UTC) dans getSession()
      'X-Client-Type': 'mobile',
    },
  },
});
