/**
 * Deep Link Auth Hook — Better Auth
 *
 * Story 15.2 — Migration Client Mobile Better Auth
 * ADR-029: Better Auth comme provider d'authentification
 *
 * Gère les deep-links pour OAuth callbacks et password reset.
 */

import { useEffect, useCallback } from 'react';
import * as Linking from 'expo-linking';
import { useToast } from '../../../design-system/components';
import { useAuthRecoveryStore } from '../../../stores/authRecoveryStore';
import { AuthTokenManager } from '../../../infrastructure/auth/AuthTokenManager';

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
