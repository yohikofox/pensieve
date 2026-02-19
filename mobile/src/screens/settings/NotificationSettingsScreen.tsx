/**
 * Notification Settings Screen
 * Story 4.4: Notifications de Progression IA
 * Task 6, Subtask 6.3: Mobile notification settings UI
 * Task 6, Subtask 6.5: Local persistence with OP-SQLite
 *
 * AC7: Users can configure notification preferences:
 * - Push notifications enable/disable
 * - Local notifications enable/disable
 * - Haptic feedback enable/disable
 *
 * Offline-first approach:
 * 1. Load from local storage immediately (instant UI)
 * 2. Sync with API in background (when online)
 * 3. Save to local storage first (instant feedback)
 * 4. Sync to API in background (eventually consistent)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuthTokenManager } from '../../infrastructure/auth/AuthTokenManager';
import { apiConfig } from '../../config/api';
import { colors } from '../../design-system/tokens';
import { Card, useToast } from '../../design-system/components';
import * as Notifications from 'expo-notifications';
import { notificationPreferencesStorage } from '../../services/storage/NotificationPreferencesStorage';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { StandardLayout } from '../../components/layouts';

export const NotificationSettingsScreen = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { isConnected } = useNetworkStatus();

  // State for notification preferences
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(true);
  const [hapticFeedbackEnabled, setHapticFeedbackEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /**
   * Load preferences (offline-first)
   * 1. Load from local storage immediately (Task 6.5)
   * 2. Sync with API in background if online
   */
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // 1. Load from local storage first (instant)
        const localPrefs = await notificationPreferencesStorage.getPreferences();
        if (localPrefs) {
          setPushNotificationsEnabled(localPrefs.pushNotificationsEnabled);
          setLocalNotificationsEnabled(localPrefs.localNotificationsEnabled);
          setHapticFeedbackEnabled(localPrefs.hapticFeedbackEnabled);
          console.log('[NotificationSettings] Loaded from local storage');
        }

        // 2. Sync with API in background if online
        if (isConnected) {
          await syncWithAPI();
        } else {
          console.log('[NotificationSettings] Offline, using cached preferences');
        }
      } catch (error) {
        console.error('[NotificationSettings] Error loading preferences:', error);
        toast.error(t('settings.notifications.loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [t, toast, isConnected]);

  /**
   * Sync preferences with API
   * Loads from server and updates local storage if different
   */
  const syncWithAPI = async () => {
    try {
      const tokenManager = new AuthTokenManager();
      const tokenResult = await tokenManager.getValidToken();

      if (tokenResult.type !== 'success' || !tokenResult.data) {
        console.warn('[NotificationSettings] No session, skipping API sync');
        return;
      }

      // Fetch from API
      const response = await fetch(apiConfig.endpoints.users.notificationSettings, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenResult.data}`,
        },
      });

      if (response.ok) {
        const serverSettings = await response.json();

        // Update UI state
        setPushNotificationsEnabled(serverSettings.pushNotificationsEnabled ?? false);
        setLocalNotificationsEnabled(serverSettings.localNotificationsEnabled ?? true);
        setHapticFeedbackEnabled(serverSettings.hapticFeedbackEnabled ?? true);

        // Update local storage with server values
        await notificationPreferencesStorage.savePreferences({
          pushNotificationsEnabled: serverSettings.pushNotificationsEnabled ?? false,
          localNotificationsEnabled: serverSettings.localNotificationsEnabled ?? true,
          hapticFeedbackEnabled: serverSettings.hapticFeedbackEnabled ?? true,
          syncedAt: new Date().toISOString(),
        });

        console.log('[NotificationSettings] Synced with API successfully');
      } else {
        console.warn('[NotificationSettings] API sync failed, using cached values');
      }
    } catch (error) {
      console.error('[NotificationSettings] API sync error:', error);
      // Continue with cached values
    }
  };

  /**
   * Save preferences (offline-first)
   * 1. Save to local storage immediately (Task 6.5)
   * 2. Sync to API in background if online
   */
  const savePreferences = async (
    push: boolean,
    local: boolean,
    haptic: boolean,
  ) => {
    setSaving(true);
    try {
      // 1. Save to local storage first (instant)
      await notificationPreferencesStorage.savePreferences({
        pushNotificationsEnabled: push,
        localNotificationsEnabled: local,
        hapticFeedbackEnabled: haptic,
        syncedAt: null, // Mark as not synced yet
      });

      console.log('[NotificationSettings] Saved to local storage');

      // 2. Sync to API in background if online
      if (isConnected) {
        await syncToAPI(push, local, haptic);
      } else {
        console.log('[NotificationSettings] Offline, will sync later');
        toast.success(t('settings.notifications.saveSuccess'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[NotificationSettings] Save error:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Sync preferences to API
   */
  const syncToAPI = async (push: boolean, local: boolean, haptic: boolean) => {
    try {
      const tokenManager = new AuthTokenManager();
      const tokenResult = await tokenManager.getValidToken();

      if (tokenResult.type !== 'success' || !tokenResult.data) {
        throw new Error(t('auth.notAuthenticated'));
      }

      // Update via API
      const response = await fetch(apiConfig.endpoints.users.notificationSettings, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenResult.data}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushNotificationsEnabled: push,
          localNotificationsEnabled: local,
          hapticFeedbackEnabled: haptic,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('settings.notifications.saveError'));
      }

      // Mark as synced in local storage
      await notificationPreferencesStorage.markAsSynced();
      console.log('[NotificationSettings] Synced to API successfully');

      toast.success(t('settings.notifications.saveSuccess'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[NotificationSettings] API sync error:', errorMessage);
      // Don't show error to user - will retry on next connection
    }
  };

  /**
   * Handle push notifications toggle
   * AC7: Respect notification settings
   */
  const handlePushToggle = async (enabled: boolean) => {
    // If enabling push notifications, request permissions
    if (enabled) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        toast.warning(t('settings.notifications.permissionDenied'));
        return;
      }
    }

    setPushNotificationsEnabled(enabled);
    await savePreferences(enabled, localNotificationsEnabled, hapticFeedbackEnabled);
  };

  /**
   * Handle local notifications toggle
   * AC7: Allow independent control of local notifications
   */
  const handleLocalToggle = async (enabled: boolean) => {
    setLocalNotificationsEnabled(enabled);
    await savePreferences(pushNotificationsEnabled, enabled, hapticFeedbackEnabled);
  };

  /**
   * Handle haptic feedback toggle
   * AC7: Allow haptic feedback customization
   */
  const handleHapticToggle = async (enabled: boolean) => {
    setHapticFeedbackEnabled(enabled);
    await savePreferences(pushNotificationsEnabled, localNotificationsEnabled, enabled);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg-screen justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <StandardLayout useSafeArea={false}>
      <ScrollView className="flex-1">
        {/* Push Notifications Section */}
      <Card variant="elevated" className="mt-5 mx-4 py-2">
        <Text className="text-xs font-semibold text-text-tertiary uppercase ml-4 mb-2 mt-2">
          {t('settings.notifications.pushSection')}
        </Text>

        <View className="flex-row items-center py-3 px-4">
          <View className="flex-1">
            <Text className="text-lg text-text-primary">
              {t('settings.notifications.pushNotifications')}
            </Text>
            <Text className="text-xs text-text-tertiary mt-0.5">
              {t('settings.notifications.pushNotificationsSubtitle')}
            </Text>
          </View>
          <View className="flex-row items-center">
            {saving && <ActivityIndicator size="small" className="mr-2" />}
            <Switch
              value={pushNotificationsEnabled}
              onValueChange={handlePushToggle}
              disabled={saving}
              trackColor={{ false: colors.neutral[200], true: colors.success[500] }}
              thumbColor={colors.neutral[0]}
            />
          </View>
        </View>
      </Card>

      {/* Local Notifications Section */}
      <Card variant="elevated" className="mt-5 mx-4 py-2">
        <Text className="text-xs font-semibold text-text-tertiary uppercase ml-4 mb-2 mt-2">
          {t('settings.notifications.localSection')}
        </Text>

        <View className="flex-row items-center py-3 px-4 border-b border-border-default">
          <View className="flex-1">
            <Text className="text-lg text-text-primary">
              {t('settings.notifications.localNotifications')}
            </Text>
            <Text className="text-xs text-text-tertiary mt-0.5">
              {t('settings.notifications.localNotificationsSubtitle')}
            </Text>
          </View>
          <View className="flex-row items-center">
            {saving && <ActivityIndicator size="small" className="mr-2" />}
            <Switch
              value={localNotificationsEnabled}
              onValueChange={handleLocalToggle}
              disabled={saving}
              trackColor={{ false: colors.neutral[200], true: colors.success[500] }}
              thumbColor={colors.neutral[0]}
            />
          </View>
        </View>

        <View className="flex-row items-center py-3 px-4">
          <View className="flex-1">
            <Text className="text-lg text-text-primary">
              {t('settings.notifications.hapticFeedback')}
            </Text>
            <Text className="text-xs text-text-tertiary mt-0.5">
              {t('settings.notifications.hapticFeedbackSubtitle')}
            </Text>
          </View>
          <View className="flex-row items-center">
            {saving && <ActivityIndicator size="small" className="mr-2" />}
            <Switch
              value={hapticFeedbackEnabled}
              onValueChange={handleHapticToggle}
              disabled={saving}
              trackColor={{ false: colors.neutral[200], true: colors.success[500] }}
              thumbColor={colors.neutral[0]}
            />
          </View>
        </View>
      </Card>

      {/* Information Card */}
      <Card variant="subtle" className="mt-5 mx-4 mb-8 p-4">
        <Text className="text-xs text-text-secondary">
          {t('settings.notifications.infoMessage')}
        </Text>
      </Card>

      {/* Offline Indicator */}
      {!isConnected && (
        <Card variant="warning" className="mx-4 mb-8 p-4">
          <Text className="text-xs text-text-primary">
            📡 Offline - Changes will sync when connection is restored
          </Text>
        </Card>
      )}
      </ScrollView>
    </StandardLayout>
  );
};
