import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../../../lib/supabase';
import { Alert } from 'react-native';

export const useDeepLinkAuth = () => {
  useEffect(() => {
    // Handle initial URL if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = async (url: string) => {
    try {
      const parsed = Linking.parse(url);

      // Check if it's an auth callback
      if (parsed.path === 'auth/callback') {
        const { access_token, refresh_token, type } = parsed.queryParams as {
          access_token?: string;
          refresh_token?: string;
          type?: string;
        };

        if (access_token && refresh_token) {
          // Set the session with the tokens from the deep link
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            Alert.alert('Authentication Error', error.message);
          } else {
            // Success! The useAuthListener hook will detect the session change
            // and navigate to the main app
            if (type === 'signup') {
              Alert.alert(
                'Welcome!',
                'Your email has been confirmed. You are now logged in.',
              );
            } else {
              Alert.alert('Success', 'You are now logged in.');
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Deep link error:', error);
    }
  };
};
