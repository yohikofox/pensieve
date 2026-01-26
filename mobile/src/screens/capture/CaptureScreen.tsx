import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import { useAuthListener } from '../../contexts/identity/hooks/useAuthListener';
import { RecordingService } from '../../contexts/capture/services/RecordingService';
import { TextCaptureService } from '../../contexts/capture/services/TextCaptureService';
import { CrashRecoveryService } from '../../contexts/capture/services/CrashRecoveryService';
import { FileStorageService } from '../../contexts/capture/services/FileStorageService';
import { StorageMonitorService } from '../../contexts/capture/services/StorageMonitorService';
import type { ICaptureRepository } from '../../contexts/capture/domain/ICaptureRepository';
import type { IPermissionService } from '../../contexts/capture/domain/IPermissionService';
import { TextCaptureInput } from '../../components/capture/TextCaptureInput';
import { RecordingOverlay } from '../../components/capture/RecordingOverlay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ICON_SIZE = (SCREEN_WIDTH - 80) / 3; // 3 icons per row with padding

type RecordingState = 'idle' | 'recording' | 'stopping';

/** Capture tool definition */
interface CaptureTool {
  id: string;
  label: string;
  iconName: keyof typeof Feather.glyphMap;
  color: string;
  available: boolean;
}

const CAPTURE_TOOLS: CaptureTool[] = [
  {
    id: 'voice',
    label: 'Voix',
    iconName: 'mic',
    color: '#4A90D9',
    available: true,
  },
  {
    id: 'text',
    label: 'Texte',
    iconName: 'edit-3',
    color: '#E85D75',
    available: true,
  },
  {
    id: 'photo',
    label: 'Photo/Vidéo',
    iconName: 'camera',
    color: '#5B9BD5',
    available: false,
  },
  {
    id: 'url',
    label: 'URL',
    iconName: 'link-2',
    color: '#8B5CF6',
    available: false,
  },
  {
    id: 'document',
    label: 'Document',
    iconName: 'file-text',
    color: '#EC4899',
    available: false,
  },
  {
    id: 'clipboard',
    label: 'Presse-papiers',
    iconName: 'clipboard',
    color: '#F59E0B',
    available: false,
  },
];

/**
 * Permission & Audio Mode Initializer
 * Ensures permissions are granted AND audio mode is configured BEFORE creating the audio recorder
 */
const CaptureScreenWithAudioMode = () => {
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
      <View style={styles.container}>
        <Text style={{ color: '#666', textAlign: 'center', padding: 20 }}>
          Permission microphone refusée.{'\n'}
          Activez-la dans Réglages → Pensieve → Microphone
        </Text>
      </View>
    );
  }

  // Show loading indicator while initializing
  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, color: '#666' }}>Initialisation...</Text>
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
  const isDisabled = disabled || !tool.available;

  return (
    <TouchableOpacity
      style={styles.toolContainer}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityLabel={tool.label}
      accessibilityHint={tool.available ? `Capturer via ${tool.label}` : 'Bientôt disponible'}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      <View
        style={[
          styles.toolButton,
          { backgroundColor: tool.color },
          isDisabled && styles.toolButtonDisabled,
        ]}
      >
        <Feather name={tool.iconName} size={36} color="#FFFFFF" />
      </View>
      <Text style={[styles.toolLabel, isDisabled && styles.toolLabelDisabled]}>
        {tool.label}
      </Text>
      {!tool.available && (
        <Text style={styles.comingSoon}>Bientôt</Text>
      )}
    </TouchableOpacity>
  );
};

/**
 * Actual CaptureScreen content
 * Only rendered after permissions are granted and audio mode is initialized
 */
const CaptureScreenContent = () => {
  const { user } = useAuthListener();
  const [state, setState] = useState<RecordingState>('idle');
  const [showTextCapture, setShowTextCapture] = useState(false);
  const [showRecordingOverlay, setShowRecordingOverlay] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Create recorder using official HIGH_QUALITY preset (permissions + audio mode already configured by parent)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Use RecordingService for business logic and persistence (via TSyringe)
  const recordingServiceRef = useRef<RecordingService | null>(null);
  const textCaptureServiceRef = useRef<TextCaptureService | null>(null);
  const repositoryRef = useRef<ICaptureRepository | null>(null);
  const permissionServiceRef = useRef<IPermissionService | null>(null);
  const fileStorageServiceRef = useRef<FileStorageService | null>(null);
  const storageMonitorServiceRef = useRef<StorageMonitorService | null>(null);

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
          message += `${recoveredCount} capture${recoveredCount > 1 ? 's récupérée' : ' récupérée'}${recoveredCount > 1 ? 's' : ''} après interruption.`;
        }
        if (failedCount > 0) {
          if (message) message += '\n';
          message += `${failedCount} capture${failedCount > 1 ? 's' : ''} non récupérable${failedCount > 1 ? 's' : ''}.`;
        }

        if (message) {
          Alert.alert(
            '🔄 Récupération après interruption',
            message,
            [{ text: 'OK' }]
          );
        }
      }
    };

    performCrashRecovery();
  }, []);

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
      Alert.alert('Erreur', 'Service d\'enregistrement non initialisé');
      setState('idle');
      return;
    }

    // Check storage before recording
    const storageMonitor = storageMonitorServiceRef.current;
    if (!storageMonitor) {
      Alert.alert(
        'Erreur',
        'Service de surveillance du stockage non disponible.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const isCritical = await storageMonitor.isStorageCriticallyLow();
      if (isCritical) {
        const storageInfo = await storageMonitor.getStorageInfo();
        Alert.alert(
          'Espace de stockage faible',
          `Il ne reste que ${storageInfo.freeFormatted} d'espace disponible.`,
          [{ text: 'OK' }]
        );
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
        Alert.alert('Erreur', result.error ?? 'Impossible de démarrer l\'enregistrement');
        setState('idle');
        return;
      }

      audioRecorder.record();
      setState('recording');
      setShowRecordingOverlay(true);
    } catch (error) {
      console.error('[CaptureScreen] Audio recorder error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement: ' + errorMessage);
      setState('idle');
    }
  };

  const stopRecording = async () => {
    setState('stopping');
    setShowRecordingOverlay(false);

    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      Alert.alert('Erreur', 'Service d\'enregistrement non initialisé');
      setState('idle');
      return;
    }

    try {
      await audioRecorder.stop();
    } catch (error) {
      console.error('[CaptureScreen] Audio recorder stop error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', 'Impossible d\'arrêter l\'enregistrement: ' + errorMessage);
      setState('idle');
      return;
    }

    const uri = audioRecorder.uri;
    const durationMs = recordingDuration * 1000;

    if (!uri) {
      Alert.alert('Erreur', 'Aucun fichier audio disponible');
      setState('idle');
      return;
    }

    const stopResult = await recordingService.stopRecording(uri, durationMs);

    if (stopResult.type !== 'success' || !stopResult.data) {
      console.error('[CaptureScreen] Failed to stop recording:', stopResult.type, stopResult.error);
      Alert.alert('Erreur', stopResult.error ?? 'Impossible de sauvegarder la capture');
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
        console.error('[CaptureScreen] Failed to move audio file:', storageResult.type, storageResult.error);
        Alert.alert('Erreur', storageResult.error ?? 'Impossible de déplacer le fichier audio');
        setState('idle');
        return;
      }

      const updateResult = await repositoryRef.current.update(stopResult.data.captureId, {
        state: 'captured',
        rawContent: storageResult.data.permanentPath,
        duration: storageResult.data.metadata.duration,
      });

      if (updateResult.type !== 'success') {
        console.error('[CaptureScreen] Failed to update capture metadata:', updateResult.type, updateResult.error);
        Alert.alert('Erreur', updateResult.error ?? 'Impossible de mettre à jour les métadonnées');
        setState('idle');
        return;
      }
    }

    Alert.alert(
      'Capture enregistrée!',
      `Durée: ${Math.floor(stopResult.data.duration / 1000)}s`,
      [{ text: 'OK' }]
    );

    setState('idle');
  };

  const cancelRecording = async () => {
    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      Alert.alert('Erreur', 'Service d\'enregistrement non initialisé');
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
      Alert.alert(
        'Attention',
        'L\'enregistrement a été arrêté mais le nettoyage a échoué.',
        [{ text: 'OK' }]
      );
    }

    setState('idle');
    setShowRecordingOverlay(false);
  };

  const handleTextCaptureSave = async (text: string): Promise<void> => {
    const textCaptureService = textCaptureServiceRef.current;
    if (!textCaptureService) {
      Alert.alert('Erreur', 'Service non initialisé');
      throw new Error('Service non initialisé');
    }

    const result = await textCaptureService.createTextCapture(text);

    if (result.type !== 'success' || !result.data) {
      const errorMsg = result.error ?? 'Impossible de sauvegarder la capture';
      Alert.alert('Erreur', errorMsg);
      throw new Error(errorMsg);
    }

    setShowTextCapture(false);

    Alert.alert(
      'Capture enregistrée!',
      'Votre pensée a été sauvegardée.',
      [{ text: 'OK' }]
    );
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
        Alert.alert('Bientôt disponible', 'Cette fonctionnalité sera disponible prochainement.');
        break;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Outils de Capture</Text>
        <Text style={styles.subtitle}>
          Choisissez un outil pour saisir votre contenu
        </Text>
      </View>

      {/* Tools Grid */}
      <View style={styles.toolsGrid}>
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
      >
        <TextCaptureInput
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  toolContainer: {
    width: ICON_SIZE,
    alignItems: 'center',
    marginBottom: 20,
  },
  toolButton: {
    width: ICON_SIZE - 20,
    height: ICON_SIZE - 20,
    borderRadius: (ICON_SIZE - 20) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
  toolLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  toolLabelDisabled: {
    color: '#8E8E93',
  },
  comingSoon: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
  },
});

// Export the wrapper component that initializes audio mode first
export { CaptureScreenWithAudioMode as CaptureScreen };
