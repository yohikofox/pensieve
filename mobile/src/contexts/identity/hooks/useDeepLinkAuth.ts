import { useEffect, useCallback } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../design-system/components';
import { useAuthRecoveryStore } from '../../../stores/authRecoveryStore';

export const useDeepLinkAuth = () => {
  const toast = useToast();
  const setPasswordRecovery = useAuthRecoveryStore((s) => s.setPasswordRecovery);

  const handleDeepLink = useCallback(async (url: string) => {
    try {
      const parsed = Linking.parse(url);

      // OAuth callback (Google, etc.) — tokens are in the URL fragment (#)
      if (parsed.path === 'auth/callback') {
        const fragment = url.split('#')[1];
        if (!fragment) return;

        const params = new URLSearchParams(fragment);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = params.get('type');

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            toast.error(error.message);
          } else {
            if (type === 'signup') {
              toast.success('Your email has been confirmed. You are now logged in.');
            } else {
              toast.success('You are now logged in.');
            }
          }
        }
        return;
      }

      // Password reset — Supabase redirects to pensine://reset-password#access_token=...&type=recovery
      // Tokens are in the URL fragment (#), not in query params (?)
      if (parsed.path === 'reset-password' || parsed.hostname === 'reset-password') {
        const fragment = url.split('#')[1];
        if (!fragment) return;

        const params = new URLSearchParams(fragment);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = params.get('type');

        if (access_token && refresh_token && type === 'recovery') {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            toast.error('Invalid or expired reset link. Please request a new one.');
          } else {
            // Signal recovery mode — MainApp will render AuthNavigator → ResetPassword
            setPasswordRecovery(true);
          }
        }
        return;
      }
    } catch (error: any) {
      console.error('Deep link error:', error);
    }
  }, [toast, setPasswordRecovery]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => subscription.remove();
  }, [handleDeepLink]);
};
