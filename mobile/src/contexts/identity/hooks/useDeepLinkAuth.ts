/**
 * Deep Link Auth Hook — Better Auth
 *
 * Story 15.2 — Migration Client Mobile Better Auth
 * ADR-029: Better Auth comme provider d'authentification
 *
 * Gère les deep-links pour OAuth callbacks et password reset.
 */

import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useToast } from '../../../design-system/components';
import { useAuthRecoveryStore } from '../../../stores/authRecoveryStore';
import { AuthTokenManager } from '../../../infrastructure/auth/AuthTokenManager';
import { isDebugModeEnabled } from '../../../stores/settingsStore';
import { database } from '../../../database';

export const useDeepLinkAuth = () => {
  const toast = useToast();
  const setPasswordRecovery = useAuthRecoveryStore((s) => s.setPasswordRecovery);

  const handleDeepLink = useCallback(async (url: string) => {
    const parsed = Linking.parse(url);

    // OAuth callback (Google, etc.) — tokens dans le fragment URL (#)
    if (parsed.path === 'auth/callback') {
      const fragment = url.split('#')[1];
      if (!fragment) return;

      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const type = params.get('type');

      if (access_token && refresh_token) {
        const expiresIn = params.get('expires_in');
        const tokenManager = new AuthTokenManager();
        await tokenManager.storeTokens(access_token, refresh_token, expiresIn ? Number(expiresIn) : 3600);
        if (type === 'signup') {
          toast.success('Your email has been confirmed. You are now logged in.');
        } else {
          toast.success('You are now logged in.');
        }
      }
      return;
    }

    // Debug SQL deeplink — pensine-dev://debug/sql?q=<base64>
    // Guard strict : ignoré silencieusement si debug OFF ou release build
    if (parsed.hostname === 'debug' && parsed.path === '/sql') {
      if (!isDebugModeEnabled()) return;
      const b64 = parsed.queryParams?.q as string | undefined;
      if (!b64) return;
      try {
        const sql = Buffer.from(b64, 'base64').toString('utf8');
        console.log('[DeepLink SQL] Executing:', sql);
        const result = database.execute(sql) as { rows?: unknown[]; rowsAffected?: number };
        const output = result.rows?.length
          ? JSON.stringify(result.rows, null, 2)
          : `rowsAffected: ${result.rowsAffected ?? 0}`;
        console.log('[DeepLink SQL] Result:', output);
        Alert.alert('SQL Result', output.substring(0, 500));
      } catch (e: unknown) {
        console.error('[DeepLink SQL] Error:', e);
        Alert.alert('SQL Error', e instanceof Error ? e.message : String(e));
      }
      return;
    }

    // Password reset — pensine://reset-password#access_token=...&type=recovery
    if (parsed.path === 'reset-password' || parsed.hostname === 'reset-password') {
      const fragment = url.split('#')[1];
      if (!fragment) return;

      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const type = params.get('type');

      if (access_token && refresh_token && type === 'recovery') {
        const expiresIn = params.get('expires_in');
        const tokenManager = new AuthTokenManager();
        await tokenManager.storeTokens(access_token, refresh_token, expiresIn ? Number(expiresIn) : 3600);
        setPasswordRecovery(true);
      } else {
        toast.error('Invalid or expired reset link. Please request a new one.');
      }
      return;
    }
  }, [toast, setPasswordRecovery]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) void handleDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      void handleDeepLink(event.url);
    });

    return () => subscription.remove();
  }, [handleDeepLink]);
};
