/**
 * useLongOfflineReminder - Long offline duration reminder
 *
 * Story 6.4 - Task 7: Notify user when offline for too long (> 24h)
 *
 * Monitors the time since last successful sync.
 * If the user has been offline for more than OFFLINE_THRESHOLD_HOURS and
 * the reminder was not recently dismissed, triggers a callback.
 *
 * Uses SyncStatusStore.lastSyncTime for timing.
 * Dismissal timestamp is stored in AsyncStorage (UI preference, ADR-022 compliant).
 *
 * @architecture Layer: Application Hook
 */

import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
// ASYNC_STORAGE_OK: UI preference (dismissed reminder timestamp) — not critical data (ADR-022)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncStatusStore } from '../stores/SyncStatusStore';

/** Offline threshold before showing reminder (24 hours in seconds) */
const OFFLINE_THRESHOLD_SECONDS = 24 * 60 * 60;

/** Storage key for dismissed reminder timestamp */
const DISMISSED_KEY = 'pensieve:long-offline-reminder-dismissed-at';

/** How long the dismissal remains valid (8 hours in ms) */
const DISMISS_DURATION_MS = 8 * 60 * 60 * 1000;

/** Check interval (5 minutes) */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Checks if the reminder was recently dismissed.
 */
async function wasRecentlyDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Persists the current timestamp as the dismissal time.
 */
async function persistDismissal(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, Date.now().toString());
  } catch {
    // Best-effort persistence; reminder will show again next cycle
  }
}

/**
 * Hook that periodically checks if the user has been offline too long
 * and shows a reminder alert.
 *
 * Should be called once inside AppContent (MainApp.tsx).
 */
export const useLongOfflineReminder = (): void => {
  const getTimeSinceLastSync = useSyncStatusStore(
    (state) => state.getTimeSinceLastSync
  );
  const isReminderShowing = useRef(false);

  const checkAndMaybeRemind = useCallback(async () => {
    if (isReminderShowing.current) return;

    const secondsOffline = getTimeSinceLastSync();

    // Only remind if beyond threshold AND has synced at least once
    if (secondsOffline === null || secondsOffline < OFFLINE_THRESHOLD_SECONDS) {
      return;
    }

    const dismissed = await wasRecentlyDismissed();
    if (dismissed) return;

    isReminderShowing.current = true;
    const hoursOffline = Math.floor(secondsOffline / 3600);

    Alert.alert(
      'Synchronisation interrompue',
      `Vous n'avez pas synchronisé depuis ${hoursOffline} heure${hoursOffline > 1 ? 's' : ''}. Vérifiez votre connexion réseau.`,
      [
        {
          text: 'Ignorer',
          onPress: () => {
            persistDismissal();
            isReminderShowing.current = false;
          },
        },
        {
          text: 'OK',
          onPress: () => {
            isReminderShowing.current = false;
          },
        },
      ],
      { cancelable: false }
    );
  }, [getTimeSinceLastSync]);

  useEffect(() => {
    // Initial check on mount
    checkAndMaybeRemind();

    // Periodic check every CHECK_INTERVAL_MS
    const intervalId = setInterval(checkAndMaybeRemind, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [checkAndMaybeRemind]);
};
