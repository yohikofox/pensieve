/**
 * Notification Settings Screen
 * Story 4.4: Notifications de Progression IA
 * Task 6, Subtask 6.3: Mobile notification settings UI
 *
 * AC7: Users can configure notification preferences:
 * - Push notifications enable/disable
 * - Local notifications enable/disable
 * - Haptic feedback enable/disable
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
import { supabase } from '../../lib/supabase';
import { apiConfig } from '../../config/api';
import { colors } from '../../design-system/tokens';
import { Card, useToast } from '../../design-system/components';
import * as Notifications from 'expo-notifications';

export const NotificationSettingsScreen = () => {
  const { t } = useTranslation();
  const toast = useToast();

  // State for notification preferences
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(true);
  const [hapticFeedbackEnabled, setHapticFeedbackEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /**
   * Load current notification preferences from backend
   * Story 4.4, Task 6, Subtask 6.3
   */
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          console.warn('[NotificationSettings] No session, using defaults');
          setLoading(false);
          return;
        }

        // Fetch current preferences from backend API
        const response = await fetch(apiConfig.endpoints.users.notificationSettings, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const settings = await response.json();
          setPushNotificationsEnabled(settings.pushNotificationsEnabled ?? false);
          setLocalNotificationsEnabled(settings.localNotificationsEnabled ?? true);
          setHapticFeedbackEnabled(settings.hapticFeedbackEnabled ?? true);
        } else {
          console.warn('[NotificationSettings] Failed to load settings, using defaults');
        }
      } catch (error) {
        console.error('[NotificationSettings] Error loading preferences:', error);
        toast.error(t('settings.notifications.loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [t, toast]);

  /**
   * Save notification preferences to backend
   * Story 4.4, Task 6, Subtask 6.3
   */
  const savePreferences = async (
    push: boolean,
    local: boolean,
    haptic: boolean,
  ) => {
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(t('auth.notAuthenticated'));
      }

      // Update preferences via backend API
      const response = await fetch(apiConfig.endpoints.users.notificationSettings, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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

      toast.success(t('settings.notifications.saveSuccess'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[NotificationSettings] Save error:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
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
    <ScrollView className="flex-1 bg-bg-screen">
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
    </ScrollView>
  );
};
