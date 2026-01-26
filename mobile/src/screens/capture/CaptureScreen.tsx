import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, Dimensions, Platform } from 'react-native';
import { useAudioRecorder, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { container } from 'tsyringe';
import { useTranslation } from 'react-i18next';
import { TOKENS } from '../../infrastructure/di/tokens';
import { useAuthListener } from '../../contexts/identity/hooks/useAuthListener';
import { RecordingService } from '../../contexts/capture/services/RecordingService';
import { TextCaptureService } from '../../contexts/capture/services/TextCaptureService';
import { CrashRecoveryService } from '../../contexts/capture/services/CrashRecoveryService';
import { FileStorageService } from '../../contexts/capture/services/FileStorageService';
import { StorageMonitorService } from '../../contexts/capture/services/StorageMonitorService';
import type { ICaptureRepository } from '../../contexts/capture/domain/ICaptureRepository';
import type { IPermissionService } from '../../contexts/capture/domain/IPermissionService';
import { TextCaptureInput, type TextCaptureInputRef } from '../../components/capture/TextCaptureInput';
import { RecordingOverlay } from '../../components/capture/RecordingOverlay';
import { colors, shadows } from '../../design-system/tokens';
import { AlertDialog, useToast } from '../../design-system/components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ICON_SIZE = (SCREEN_WIDTH - 80) / 3; // 3 icons per row with padding

type RecordingState = 'idle' | 'recording' | 'stopping';

/** Capture tool definition */
interface CaptureTool {
  id: string;
  labelKey: string;
  iconName: keyof typeof Feather.glyphMap;
  color: string;
  available: boolean;
}

/**
 * Capture tools configuration
 *
 * Icon design principles:
 * - Symbolic, not literal (represent the action/concept)
 * - Minimalist line icons (Feather)
 * - Consistent visual weight
 */
const CAPTURE_TOOLS: CaptureTool[] = [
  {
    id: 'voice',
    labelKey: 'capture.tools.voice',
    iconName: 'mic',              // Universal microphone symbol
    color: colors.primary[500],
    available: true,
  },
  {
    id: 'text',
    labelKey: 'capture.tools.text',
    iconName: 'type',             // Typography symbol = text input
    color: colors.secondary[500],
    available: true,
  },
  {
    id: 'photo',
    labelKey: 'capture.tools.photo',
    iconName: 'aperture',         // Aperture = photography concept
    color: colors.info[500],
    available: false,
  },
  {
    id: 'url',
    labelKey: 'capture.tools.url',
    iconName: 'globe',            // Globe = web/internet
    color: colors.primary[700],
    available: false,
  },
  {
    id: 'document',
    labelKey: 'capture.tools.document',
    iconName: 'file',             // Simple file symbol
    color: colors.secondary[700],
    available: false,
  },
  {
    id: 'clipboard',
    labelKey: 'capture.tools.clipboard',
    iconName: 'copy',             // Copy = clipboard action
    color: colors.warning[500],
    available: false,
  },
];

/**
 * Permission & Audio Mode Initializer
 * Ensures permissions are granted AND audio mode is configured BEFORE creating the audio recorder
 */
const CaptureScreenWithAudioMode = () => {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Step 1: Get permission service
        const permissionService = container.resolve<IPermissionService>(TOKENS.IPermissionService);

        // Step 2: Check/request microphone permission FIRST
        let hasPermission = await permissionService.hasMicrophonePermission();

        if (!hasPermission) {
          console.log('[CaptureScreen] Requesting microphone permission...');
          const result = await permissionService.requestMicrophonePermission();

          if (result.status !== 'granted') {
            console.log('[CaptureScreen] ❌ Microphone permission denied');
            setPermissionDenied(true);
            return;
          }

          hasPermission = true;
          console.log('[CaptureScreen] ✅ Microphone permission granted');
        }

        // Step 3: Configure audio mode
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
        console.log('[CaptureScreen] ✅ Audio mode initialized for recording');

        // Step 4: Everything ready, can create recorder now
        setIsReady(true);
      } catch (error) {
        console.error('[CaptureScreen] ❌ Failed to initialize:', error);
        // Set ready anyway to avoid blocking the UI
        setIsReady(true);
      }
    };
    initialize();
  }, []);

  // Show permission denied message
  if (permissionDenied) {
    return (
      <View className="flex-1 bg-neutral-100 dark:bg-neutral-900 justify-center items-center">
        <Text className="text-neutral-500 dark:text-neutral-400 text-center px-5">
          {t('capture.alerts.permissionDenied')}
          {'\n'}
          {t('capture.alerts.permissionHint')}
        </Text>
      </View>
    );
  }

  // Show loading indicator while initializing
  if (!isReady) {
    return (
      <View className="flex-1 bg-neutral-100 dark:bg-neutral-900 justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text className="mt-4 text-neutral-500 dark:text-neutral-400">{t('capture.recording.initializing')}</Text>
      </View>
    );
  }

  // Once ready (permissions + audio mode), render the actual CaptureScreen with recorder
  return <CaptureScreenContent />;
};

/**
 * Capture Tool Button Component
 */
const CaptureToolButton = ({
  tool,
  onPress,
  disabled,
}: {
  tool: CaptureTool;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  const isDisabled = disabled || !tool.available;
  const label = t(tool.labelKey);

  return (
    <TouchableOpacity
      className="items-center mb-5"
      style={{ width: ICON_SIZE }}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityLabel={label}
      accessibilityHint={
        tool.available
          ? t(`capture.toolHints.${tool.id}` as any)
          : t('common.comingSoon')
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      <View
        className={`justify-center items-center rounded-full ${isDisabled ? 'opacity-50' : ''}`}
        style={[
          {
            width: ICON_SIZE - 20,
            height: ICON_SIZE - 20,
            borderRadius: (ICON_SIZE - 20) / 2,
            backgroundColor: tool.color,
          },
          !isDisabled && shadows.md,
        ]}
      >
        <Feather name={tool.iconName} size={36} color={colors.neutral[0]} />
      </View>
      <Text
        className={`mt-2 text-sm font-semibold text-center ${
          isDisabled ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-50'
        }`}
      >
        {label}
      </Text>
      {!tool.available && (
        <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{t('common.comingSoon')}</Text>
      )}
    </TouchableOpacity>
  );
};

/**
 * Actual CaptureScreen content
 * Only rendered after permissions are granted and audio mode is initialized
 */
const CaptureScreenContent = () => {
  const { t } = useTranslation();
  const { user } = useAuthListener();
  const [state, setState] = useState<RecordingState>('idle');
  const [showTextCapture, setShowTextCapture] = useState(false);
  const [showRecordingOverlay, setShowRecordingOverlay] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Toast and dialog states
  const toast = useToast();
  const [showStorageWarningDialog, setShowStorageWarningDialog] = useState(false);
  const [showSavedDialog, setShowSavedDialog] = useState(false);
  const [lastSavedCaptureId, setLastSavedCaptureId] = useState<string | null>(null);
  const [pendingRecordStart, setPendingRecordStart] = useState(false);

  // Create recorder using official HIGH_QUALITY preset (permissions + audio mode already configured by parent)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Use RecordingService for business logic and persistence (via TSyringe)
  const recordingServiceRef = useRef<RecordingService | null>(null);
  const textCaptureServiceRef = useRef<TextCaptureService | null>(null);
  const repositoryRef = useRef<ICaptureRepository | null>(null);
  const permissionServiceRef = useRef<IPermissionService | null>(null);
  const fileStorageServiceRef = useRef<FileStorageService | null>(null);
  const storageMonitorServiceRef = useRef<StorageMonitorService | null>(null);
  const textCaptureInputRef = useRef<TextCaptureInputRef>(null);

  // Initialize services on mount via TSyringe container
  useEffect(() => {
    recordingServiceRef.current = container.resolve(RecordingService);
    textCaptureServiceRef.current = container.resolve(TextCaptureService);
    repositoryRef.current = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
    permissionServiceRef.current = container.resolve<IPermissionService>(TOKENS.IPermissionService);
    fileStorageServiceRef.current = container.resolve(FileStorageService);
    storageMonitorServiceRef.current = container.resolve(StorageMonitorService);
  }, []);

  // AC4: Crash recovery on app launch
  useEffect(() => {
    const performCrashRecovery = async () => {
      const crashRecoveryService = container.resolve(CrashRecoveryService);
      const recovered = await crashRecoveryService.recoverIncompleteRecordings();

      if (recovered.length > 0) {
        const recoveredCount = recovered.filter((r) => r.state === 'recovered').length;
        const failedCount = recovered.filter((r) => r.state === 'failed').length;

        let message = '';
        if (recoveredCount > 0) {
          message += t('capture.recovery.recovered', { count: recoveredCount });
        }
        if (failedCount > 0) {
          if (message) message += '\n';
          message += t('capture.recovery.failed', { count: failedCount });
        }

        if (message) {
          toast.info(message);
        }
      }
    };

    performCrashRecovery();
  }, [t]);

  // Timer for recording duration display
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (state === 'recording') {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [state]);

  const startRecording = async () => {
    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      toast.error(t('capture.alerts.serviceNotInitialized'));
      setState('idle');
      return;
    }

    // Check storage before recording
    const storageMonitor = storageMonitorServiceRef.current;
    if (!storageMonitor) {
      toast.error(t('capture.alerts.serviceNotInitialized'));
      return;
    }

    try {
      const isCritical = await storageMonitor.isStorageCriticallyLow();
      if (isCritical) {
        toast.warning(t('capture.alerts.lowStorage'));
        return;
      }
    } catch (error) {
      console.error('[CaptureScreen] Storage check failed:', error);
    }

    try {
      await audioRecorder.prepareToRecordAsync();
      const tempUri = audioRecorder.uri;

      if (!tempUri) {
        throw new Error('No URI available after prepare');
      }

      const result = await recordingService.startRecording(tempUri);

      if (result.type !== 'success') {
        console.error('[CaptureScreen] Failed to start recording:', result.type, result.error);
        toast.error(result.error ?? t('capture.alerts.error'));
        setState('idle');
        return;
      }

      audioRecorder.record();
      setState('recording');
      setShowRecordingOverlay(true);
    } catch (error) {
      console.error('[CaptureScreen] Audio recorder error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t('capture.alerts.startError', { error: errorMessage }));
      setState('idle');
    }
  };

  const stopRecording = async () => {
    setState('stopping');
    setShowRecordingOverlay(false);

    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      toast.error(t('capture.alerts.serviceNotInitialized'));
      setState('idle');
      return;
    }

    try {
      await audioRecorder.stop();
    } catch (error) {
      console.error('[CaptureScreen] Audio recorder stop error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t('capture.alerts.stopError', { error: errorMessage }));
      setState('idle');
      return;
    }

    const uri = audioRecorder.uri;
    const durationMs = recordingDuration * 1000;

    if (!uri) {
      toast.error(t('capture.alerts.noAudioFile'));
      setState('idle');
      return;
    }

    const stopResult = await recordingService.stopRecording(uri, durationMs);

    if (stopResult.type !== 'success' || !stopResult.data) {
      console.error('[CaptureScreen] Failed to stop recording:', stopResult.type, stopResult.error);
      toast.error(stopResult.error ?? t('capture.alerts.error'));
      setState('idle');
      return;
    }

    if (fileStorageServiceRef.current && repositoryRef.current) {
      const storageResult = await fileStorageServiceRef.current.moveToStorage(
        stopResult.data.filePath,
        stopResult.data.captureId,
        stopResult.data.duration
      );

      if (storageResult.type !== 'success' || !storageResult.data) {
        console.error(
          '[CaptureScreen] Failed to move audio file:',
          storageResult.type,
          storageResult.error
        );
        toast.error(storageResult.error ?? t('capture.alerts.error'));
        setState('idle');
        return;
      }

      const updateResult = await repositoryRef.current.update(stopResult.data.captureId, {
        state: 'captured',
        rawContent: storageResult.data.permanentPath,
        duration: storageResult.data.metadata.duration,
      });

      if (updateResult.type !== 'success') {
        console.error(
          '[CaptureScreen] Failed to update capture metadata:',
          updateResult.type,
          updateResult.error
        );
        toast.error(updateResult.error ?? t('capture.alerts.error'));
        setState('idle');
        return;
      }
    }

    toast.success(t('capture.alerts.savedVoice', { duration: Math.floor(stopResult.data.duration / 1000) }));

    setState('idle');
  };

  const cancelRecording = async () => {
    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      toast.error(t('capture.alerts.serviceNotInitialized'));
      setState('idle');
      setShowRecordingOverlay(false);
      return;
    }

    try {
      await audioRecorder.stop();
    } catch (error) {
      console.error('[CaptureScreen] Failed to stop audio recorder during cancel:', error);
    }

    const result = await recordingService.cancelRecording();

    if (result.type !== 'success') {
      console.error('[CaptureScreen] Failed to cancel recording:', result.type, result.error);
      toast.warning(t('capture.alerts.cancelWarning'));
    }

    setState('idle');
    setShowRecordingOverlay(false);
  };

  const handleTextCaptureSave = async (text: string): Promise<void> => {
    const textCaptureService = textCaptureServiceRef.current;
    if (!textCaptureService) {
      toast.error(t('capture.alerts.serviceNotInitialized'));
      throw new Error('Service not initialized');
    }

    const result = await textCaptureService.createTextCapture(text);

    if (result.type !== 'success' || !result.data) {
      const errorMsg = result.error ?? t('capture.alerts.error');
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    setShowTextCapture(false);

    toast.success(t('capture.alerts.savedText'));
  };

  const handleTextCaptureCancel = () => {
    setShowTextCapture(false);
  };

  const handleToolPress = (toolId: string) => {
    switch (toolId) {
      case 'voice':
        startRecording();
        break;
      case 'text':
        setShowTextCapture(true);
        break;
      case 'photo':
      case 'url':
      case 'document':
      case 'clipboard':
        toast.info(t('common.comingSoon'));
        break;
    }
  };

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      {/* Header */}
      <View className="items-center pt-14 pb-10 px-6">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">{t('capture.title')}</Text>
        <Text className="text-base text-neutral-400 dark:text-neutral-500 text-center">{t('capture.subtitle')}</Text>
      </View>

      {/* Tools Grid */}
      <View className="flex-row flex-wrap justify-center px-5 gap-4">
        {CAPTURE_TOOLS.map((tool) => (
          <CaptureToolButton
            key={tool.id}
            tool={tool}
            onPress={() => handleToolPress(tool.id)}
            disabled={state !== 'idle'}
          />
        ))}
      </View>

      {/* Text Capture Modal */}
      <Modal
        visible={showTextCapture}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleTextCaptureCancel}
        onShow={() => {
          console.log('[CaptureScreen] Modal onShow triggered');
          // Focus the input after modal animation completes
          // On Android, need blur then focus to trigger keyboard
          setTimeout(() => {
            console.log('[CaptureScreen] Triggering focus');
            if (Platform.OS === 'android') {
              textCaptureInputRef.current?.blur();
              setTimeout(() => {
                textCaptureInputRef.current?.focus();
              }, 100);
            } else {
              textCaptureInputRef.current?.focus();
            }
          }, 300);
        }}
      >
        <TextCaptureInput
          ref={textCaptureInputRef}
          onSave={handleTextCaptureSave}
          onCancel={handleTextCaptureCancel}
        />
      </Modal>

      {/* Recording Overlay */}
      <Modal
        visible={showRecordingOverlay}
        animationType="fade"
        transparent={true}
        onRequestClose={cancelRecording}
      >
        <RecordingOverlay
          duration={recordingDuration}
          onStop={stopRecording}
          onCancel={cancelRecording}
          isStopping={state === 'stopping'}
        />
      </Modal>
    </View>
  );
};

// Export the wrapper component that initializes audio mode first
export { CaptureScreenWithAudioMode as CaptureScreen };
