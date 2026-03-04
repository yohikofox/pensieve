/**
 * App Providers
 *
 * Centralized provider hierarchy for the entire app.
 * Reusable in tests, Storybook, or other entry points.
 *
 * Provider order matters:
 * 1. SafeAreaProvider - Safe area insets
 * 2. QueryProvider - React Query cache
 * 3. ThemeProvider - Theme context and CSS variables
 * 4. ToastProvider - Toast notifications
 * 5. NetworkProvider - Network connectivity status
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../contexts/theme/ThemeProvider';
import { ToastProvider } from '../design-system/components';
import { NetworkProvider } from '../contexts/NetworkContext';
import { QueryProvider } from './QueryProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryProvider>
          <ThemeProvider>
            <ToastProvider>
              <NetworkProvider>
                {children}
              </NetworkProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});
