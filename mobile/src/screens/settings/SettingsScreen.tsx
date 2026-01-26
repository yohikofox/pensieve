import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiConfig } from '../../config/api';
import { container } from 'tsyringe';
import { WhisperModelService } from '../../contexts/Normalization/services/WhisperModelService';
import { LLMModelService } from '../../contexts/Normalization/services/LLMModelService';
import { TranscriptionEngineService } from '../../contexts/Normalization/services/TranscriptionEngineService';
import { useSettingsStore, type ThemePreference } from '../../stores/settingsStore';
import { GoogleCalendarService, type GoogleAuthState } from '../../services/GoogleCalendarService';
import type { SettingsStackParamList } from '../../navigation/SettingsStackNavigator';
import { colors } from '../../design-system/tokens';
import { Card, Button, AlertDialog, useToast } from '../../design-system/components';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'SettingsMain'>;

export const SettingsScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [engineLabel, setEngineLabel] = useState<string>(
    t('settings.transcription.engineOptions.whisper')
  );
  const [selectedModelLabel, setSelectedModelLabel] = useState<string>(t('common.notConfigured'));
  const [llmStatusLabel, setLlmStatusLabel] = useState<string>(t('common.disabled'));

  // Theme preference from global settings store
  const themePreference = useSettingsStore((state) => state.themePreference);

  // Debug mode from global settings store
  const debugMode = useSettingsStore((state) => state.debugMode);
  const toggleDebugMode = useSettingsStore((state) => state.toggleDebugMode);

  // Get theme label for display
  const getThemeLabel = (preference: ThemePreference): string => {
    const labels: Record<ThemePreference, string> = {
      light: t('settings.appearance.themeOptions.light'),
      dark: t('settings.appearance.themeOptions.dark'),
      system: t('settings.appearance.themeOptions.system'),
    };
    return labels[preference];
  };

  // Google Calendar state
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthState>({
    isConnected: false,
    userEmail: null,
    isLoading: true,
  });
  const [googleConnecting, setGoogleConnecting] = useState(false);

  // Dialog states
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteSuccessDialog, setShowDeleteSuccessDialog] = useState(false);
  const toast = useToast();

  const modelService = new WhisperModelService();
  const llmModelService = new LLMModelService();
  const engineService = container.resolve(TranscriptionEngineService);

  // Load transcription engine on mount and when returning to screen
  useEffect(() => {
    const loadEngine = async () => {
      try {
        const engines = await engineService.getAvailableEngines();
        const selectedType = await engineService.getSelectedEngineType();
        const selected = engines.find((e) => e.type === selectedType);
        setEngineLabel(selected?.displayName || t('settings.transcription.engineOptions.whisper'));
      } catch (error) {
        console.error('[Settings] Failed to load engine:', error);
      }
    };

    loadEngine();
    const unsubscribe = navigation.addListener('focus', loadEngine);
    return unsubscribe;
  }, [navigation, t]);

  // Load selected model label on mount and when returning to screen
  useEffect(() => {
    const loadSelectedModel = async () => {
      const selected = await modelService.getBestAvailableModel();
      if (selected) {
        const labels: Record<string, string> = {
          tiny: t('settings.transcription.modelOptions.tiny'),
          base: t('settings.transcription.modelOptions.base'),
          small: t('settings.transcription.modelOptions.small'),
          medium: t('settings.transcription.modelOptions.medium'),
        };
        setSelectedModelLabel(labels[selected] || selected);
      } else {
        setSelectedModelLabel(t('common.notConfigured'));
      }
    };

    loadSelectedModel();

    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener('focus', loadSelectedModel);
    return unsubscribe;
  }, [navigation, t]);

  // Load LLM status on mount and when returning to screen
  useEffect(() => {
    const loadLlmStatus = async () => {
      const enabled = await llmModelService.isPostProcessingEnabled();
      if (!enabled) {
        setLlmStatusLabel(t('common.disabled'));
        return;
      }

      const selected = await llmModelService.getSelectedModel();
      if (selected) {
        const config = llmModelService.getModelConfig(selected);
        setLlmStatusLabel(config.name);
      } else {
        setLlmStatusLabel(t('common.enabled'));
      }
    };

    loadLlmStatus();

    const unsubscribe = navigation.addListener('focus', loadLlmStatus);
    return unsubscribe;
  }, [navigation, t]);

  // Load Google Calendar auth state
  const loadGoogleAuthState = useCallback(async () => {
    try {
      const authState = await GoogleCalendarService.getAuthState();
      setGoogleAuth({ ...authState, isLoading: false });
    } catch (error) {
      console.error('[Settings] Failed to load Google auth state:', error);
      setGoogleAuth({ isConnected: false, userEmail: null, isLoading: false });
    }
  }, []);

  useEffect(() => {
    loadGoogleAuthState();
    const unsubscribe = navigation.addListener('focus', loadGoogleAuthState);
    return unsubscribe;
  }, [navigation, loadGoogleAuthState]);

  /**
   * Handle Google Calendar connect
   */
  const handleGoogleConnect = async () => {
    setGoogleConnecting(true);
    try {
      const result = await GoogleCalendarService.connect();

      if (result.success) {
        await loadGoogleAuthState();
        toast.success(t('settings.integrations.connectSuccess'));
      } else {
        toast.error(result.error || t('settings.integrations.connectError'));
      }
    } catch (error) {
      console.error('[Settings] Google connect error:', error);
      toast.error(t('settings.integrations.connectError'));
    } finally {
      setGoogleConnecting(false);
    }
  };

  /**
   * Handle Google Calendar disconnect
   */
  const handleGoogleDisconnect = () => {
    setShowDisconnectDialog(true);
  };

  const confirmGoogleDisconnect = async () => {
    setShowDisconnectDialog(false);
    try {
      await GoogleCalendarService.disconnect();
      setGoogleAuth({ isConnected: false, userEmail: null, isLoading: false });
    } catch (error) {
      console.error('[Settings] Google disconnect error:', error);
    }
  };

  /**
   * Handle Data Export
   */
  const handleExportData = () => {
    setShowExportDialog(true);
  };

  const executeExport = async () => {
    setShowExportDialog(false);
    setExportLoading(true);

    try {
      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(t('auth.notAuthenticated'));
      }

      // Call export API (POST request)
      const response = await fetch(apiConfig.endpoints.rgpd.export, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = t('errors.unknown');
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText.substring(0, 100);
        }
        throw new Error(`HTTP ${response.status}: ${errorMessage}`);
      }

      // Download ZIP blob
      const blob = await response.blob();

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            const base64Data = await base64Promise;

            // Save to file system
            const filename = `pensine-export-${Date.now()}.zip`;
            const localPath = `${FileSystem.documentDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(localPath, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Share ZIP (user can save to Files app or email)
            await Sharing.shareAsync(localPath, {
              mimeType: 'application/zip',
              dialogTitle: t('settings.privacy.exportData'),
            });

      toast.success(t('settings.privacy.exportSuccessMessage'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t('settings.privacy.exportError', { error: errorMessage }));
    } finally {
      setExportLoading(false);
    }
  };

  /**
   * Handle Account Deletion
   */
  const handleDeleteAccount = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteAccount = () => {
    setShowDeleteDialog(false);
    promptPasswordConfirmation();
  };

  /**
   * Prompt password confirmation for account deletion
   */
  const promptPasswordConfirmation = () => {
    setPassword('');
    setPasswordModalVisible(true);
  };

  /**
   * Handle password confirmation from modal
   */
  const handlePasswordConfirm = async () => {
    if (!password || password.trim() === '') {
      toast.error(t('settings.privacy.passwordRequired'));
      return;
    }
    setPasswordModalVisible(false);
    await executeAccountDeletion(password);
  };

  /**
   * Handle modal cancel
   */
  const handlePasswordCancel = () => {
    setPassword('');
    setPasswordModalVisible(false);
  };

  /**
   * Execute account deletion (call API)
   */
  const executeAccountDeletion = async (password: string) => {
    setDeleteLoading(true);

    try {
      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(t('auth.notAuthenticated'));
      }

      // Call deletion API
      const response = await fetch(apiConfig.endpoints.rgpd.deleteAccount, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.status === 204) {
        // Deletion successful
        setShowDeleteSuccessDialog(true);
      } else if (response.status === 401) {
        toast.error(t('settings.privacy.incorrectPassword'));
      } else {
        const error = await response.json();
        toast.error(error.message || t('settings.privacy.deleteError', { error: '' }));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t('settings.privacy.deleteError', { error: errorMessage }));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSuccessConfirm = async () => {
    setShowDeleteSuccessDialog(false);
    await supabase.auth.signOut();
    // Navigation handled by auth state listener
  };

  return (
    <>
      <ScrollView className="flex-1 bg-neutral-100 dark:bg-neutral-900">
        {/* Appearance Section */}
        <Card variant="elevated" className="mt-5 mx-4 py-2">
          <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase ml-4 mb-2 mt-2">
            {t('settings.sections.appearance')}
          </Text>

          <TouchableOpacity
            className="flex-row items-center py-3 px-4"
            onPress={() => navigation.navigate('ThemeSettings')}
          >
            <View className="flex-1">
              <Text className="text-lg text-neutral-900 dark:text-neutral-50">
                {t('settings.appearance.theme')}
              </Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {t('settings.appearance.themeSubtitle')}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-base text-neutral-400 dark:text-neutral-500 mr-1">
                {getThemeLabel(themePreference)}
              </Text>
              <Text className="text-xl text-neutral-300 dark:text-neutral-600 font-semibold">›</Text>
            </View>
          </TouchableOpacity>
        </Card>

        {/* Transcription Section */}
        <Card variant="elevated" className="mt-5 mx-4 py-2">
          <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase ml-4 mb-2 mt-2">
            {t('settings.sections.transcription')}
          </Text>

          <TouchableOpacity
            className="flex-row items-center py-3 px-4 border-b border-neutral-200 dark:border-neutral-700"
            onPress={() => navigation.navigate('TranscriptionEngineSettings')}
          >
            <View className="flex-1">
              <Text className="text-lg text-neutral-900 dark:text-neutral-50">{t('settings.transcription.engine')}</Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {t('settings.transcription.engineSubtitle')}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-base text-neutral-400 dark:text-neutral-500 mr-1">{engineLabel}</Text>
              <Text className="text-xl text-neutral-300 dark:text-neutral-600 font-semibold">›</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center py-3 px-4 border-b border-neutral-200 dark:border-neutral-700"
            onPress={() => navigation.navigate('WhisperSettings')}
          >
            <View className="flex-1">
              <Text className="text-lg text-neutral-900 dark:text-neutral-50">
                {t('settings.transcription.whisperModel')}
              </Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {t('settings.transcription.whisperModelSubtitle')}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-base text-neutral-400 dark:text-neutral-500 mr-1">{selectedModelLabel}</Text>
              <Text className="text-xl text-neutral-300 dark:text-neutral-600 font-semibold">›</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center py-3 px-4"
            onPress={() => navigation.navigate('LLMSettings')}
          >
            <View className="flex-1">
              <Text className="text-lg text-neutral-900 dark:text-neutral-50">
                {t('settings.transcription.aiEnhancement')}
              </Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {t('settings.transcription.aiEnhancementSubtitle')}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-base text-neutral-400 dark:text-neutral-500 mr-1">{llmStatusLabel}</Text>
              <Text className="text-xl text-neutral-300 dark:text-neutral-600 font-semibold">›</Text>
            </View>
          </TouchableOpacity>
        </Card>

        {/* Integrations Section */}
        <Card variant="elevated" className="mt-5 mx-4 py-2">
          <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase ml-4 mb-2 mt-2">
            {t('settings.sections.integrations')}
          </Text>

          <TouchableOpacity
            className="flex-row items-center py-3 px-4"
            onPress={googleAuth.isConnected ? handleGoogleDisconnect : handleGoogleConnect}
            disabled={googleConnecting || googleAuth.isLoading}
          >
            <View className="flex-1">
              <View className="flex-row items-center">
                <Feather name="calendar" size={20} color={colors.primary[600]} style={{ marginRight: 8 }} />
                <Text className="text-lg text-neutral-900 dark:text-neutral-50">
                  {t('settings.integrations.googleCalendar')}
                </Text>
              </View>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {googleAuth.isConnected
                  ? t('settings.integrations.googleCalendarConnected', {
                      email: googleAuth.userEmail || '',
                    })
                  : t('settings.integrations.googleCalendarSubtitle')}
              </Text>
            </View>
            <View className="flex-row items-center">
              {googleConnecting || googleAuth.isLoading ? (
                <ActivityIndicator size="small" />
              ) : googleAuth.isConnected ? (
                <Text className="text-xs font-semibold text-success-500 bg-success-50 dark:bg-success-900 px-2 py-1 rounded">
                  {t('settings.integrations.connected')}
                </Text>
              ) : (
                <Text className="text-base font-medium text-primary-500 dark:text-primary-400">
                  {t('settings.integrations.connect')}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </Card>

        {/* RGPD Section */}
        <Card variant="elevated" className="mt-5 mx-4 py-2">
          <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase ml-4 mb-2 mt-2">
            {t('settings.sections.privacy')}
          </Text>

          {/* Export Data */}
          <TouchableOpacity
            className="flex-row items-center py-3 px-4 border-b border-neutral-200 dark:border-neutral-700"
            onPress={handleExportData}
            disabled={exportLoading}
          >
            <View className="flex-1">
              <Text className="text-lg text-neutral-900 dark:text-neutral-50">{t('settings.privacy.exportData')}</Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {t('settings.privacy.exportDataSubtitle')}
              </Text>
            </View>
            {exportLoading && <ActivityIndicator />}
          </TouchableOpacity>

          {/* Delete Account */}
          <TouchableOpacity
            className="flex-row items-center py-3 px-4"
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
          >
            <View className="flex-1">
              <Text className="text-lg text-error-500 dark:text-error-400">{t('settings.privacy.deleteAccount')}</Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {t('settings.privacy.deleteAccountSubtitle')}
              </Text>
            </View>
            {deleteLoading && <ActivityIndicator />}
          </TouchableOpacity>
        </Card>

        {/* Development Section */}
        <Card variant="elevated" className="mt-5 mb-8 mx-4 py-2">
          <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase ml-4 mb-2 mt-2">
            {t('settings.sections.development')}
          </Text>

          <View className="flex-row items-center py-3 px-4">
            <View className="flex-1">
              <Text className="text-lg text-neutral-900 dark:text-neutral-50">
                {t('settings.development.debugMode')}
              </Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {t('settings.development.debugModeSubtitle')}
              </Text>
            </View>
            <Switch
              value={debugMode}
              onValueChange={toggleDebugMode}
              trackColor={{ false: colors.neutral[200], true: colors.success[500] }}
              thumbColor={colors.neutral[0]}
            />
          </View>
        </Card>
      </ScrollView>

      {/* Password Confirmation Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handlePasswordCancel}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <Card variant="elevated" className="w-4/5 max-w-[400px] p-5">
            <Text className="text-lg font-semibold text-neutral-900 text-center mb-2">
              {t('settings.privacy.passwordConfirmTitle')}
            </Text>
            <Text className="text-xs text-neutral-400 text-center mb-4">
              {t('settings.privacy.passwordConfirmMessage')}
            </Text>

            <TextInput
              className="border border-neutral-200 rounded-base p-3 text-lg mb-4 bg-neutral-50"
              placeholder={t('settings.privacy.passwordPlaceholder')}
              secureTextEntry={true}
              value={password}
              onChangeText={setPassword}
              autoFocus={true}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={colors.neutral[400]}
            />

            <View className="flex-row justify-between gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onPress={handlePasswordCancel}
              >
                {t('common.cancel')}
              </Button>

              <Button
                variant="danger"
                size="lg"
                className="flex-1"
                onPress={handlePasswordConfirm}
              >
                {t('common.confirm')}
              </Button>
            </View>
          </Card>
        </View>
      </Modal>

      {/* AlertDialogs */}
      <AlertDialog
        visible={showDisconnectDialog}
        onClose={() => setShowDisconnectDialog(false)}
        variant="warning"
        title={t('settings.integrations.disconnectTitle')}
        message={t('settings.integrations.disconnectMessage')}
        confirmAction={{
          label: t('settings.integrations.disconnect'),
          variant: 'danger',
          onPress: confirmGoogleDisconnect,
        }}
      />

      <AlertDialog
        visible={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        variant="default"
        title={t('settings.privacy.exportConfirmTitle')}
        message={t('settings.privacy.exportConfirmMessage')}
        confirmAction={{
          label: t('settings.privacy.exportButton'),
          onPress: executeExport,
        }}
      />

      <AlertDialog
        visible={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        variant="danger"
        title={t('settings.privacy.deleteConfirmTitle')}
        message={t('settings.privacy.deleteConfirmMessage')}
        confirmAction={{
          label: t('common.delete'),
          onPress: confirmDeleteAccount,
        }}
      />

      <AlertDialog
        visible={showDeleteSuccessDialog}
        onClose={handleDeleteSuccessConfirm}
        variant="default"
        icon="check-circle"
        title={t('settings.privacy.deleteSuccess')}
        message={t('settings.privacy.deleteSuccessMessage')}
        cancelAction={false}
        confirmAction={{
          label: t('common.ok'),
          onPress: handleDeleteSuccessConfirm,
        }}
      />
    </>
  );
};
