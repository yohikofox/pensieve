import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
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
import { useDevPanel } from '../../components/dev/DevPanelContext';
import { CaptureDevTools } from '../../components/dev/CaptureDevTools';
import { TranscriptionQueueDebug } from '../../components/dev/TranscriptionQueueDebug';
import { TextCaptureInput } from '../../components/capture/TextCaptureInput';
import { RecordButtonUI } from '../../contexts/capture/ui/RecordButtonUI';

type RecordingState = 'idle' | 'recording' | 'stopping';

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
 * Actual CaptureScreen content
 * Only rendered after permissions are granted and audio mode is initialized
 */
const CaptureScreenContent = () => {
  const { user } = useAuthListener();
  const { registerTab, unregisterTab } = useDevPanel();
  const [state, setState] = useState<RecordingState>('idle');
  const [showTextCapture, setShowTextCapture] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0); // Story 2.3: Timer for RecordButtonUI

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
      // Resolve via TSyringe container
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

  // Story 2.3: Timer for recording duration display
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

  // Story 2.5: Register contextual debug tabs for CaptureScreen
  useEffect(() => {
    // Register Captures DB tab
    registerTab({
      id: 'captures-db',
      label: '📦 DB',
      component: <CaptureDevTools />,
      priority: 100, // First tab (before Queue)
    });

    // Register Transcription Queue tab
    registerTab({
      id: 'transcription-queue',
      label: '🎙️ Queue',
      component: <TranscriptionQueueDebug alwaysExpanded />,
      priority: 200, // Second tab
    });

    // Cleanup on unmount (unregister tabs when leaving screen)
    return () => {
      unregisterTab('captures-db');
      unregisterTab('transcription-queue');
    };
  }, [registerTab, unregisterTab]);

  const startRecording = async () => {
    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      Alert.alert('Erreur', 'Service d\'enregistrement non initialisé');
      setState('idle');
      return;
    }

    // AC2: Check storage before recording
    const storageMonitor = storageMonitorServiceRef.current;
    if (!storageMonitor) {
      Alert.alert(
        'Erreur',
        'Service de surveillance du stockage non disponible. Impossible de vérifier l\'espace disponible.',
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
          `Il ne reste que ${storageInfo.freeFormatted} d'espace disponible. Libérez de l'espace avant d'enregistrer pour éviter la perte de données.`,
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (error) {
      console.error('[CaptureScreen] Storage check failed:', error);
      // If storage check fails, proceed with caution but warn user
      console.warn('[CaptureScreen] Proceeding without storage verification (check failed)');
    }

    // Permissions and audio mode already configured by parent component
    // Prepare expo-audio recording (external lib - try/catch allowed)
    try {
      await audioRecorder.prepareToRecordAsync();
      const tempUri = audioRecorder.uri;

      if (!tempUri) {
        throw new Error('No URI available after prepare');
      }

      // NOW create Capture entity with temporary URI
      const result = await recordingService.startRecording(tempUri);

      if (result.type !== 'success') {
        console.error('[CaptureScreen] Failed to start recording:', result.type, result.error);
        Alert.alert('Erreur', result.error ?? 'Impossible de démarrer l\'enregistrement');
        setState('idle');
        return;
      }

      // Start actual recording
      audioRecorder.record();
      setState('recording');
    } catch (error) {
      console.error('[CaptureScreen] Audio recorder error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement audio: ' + errorMessage);
      setState('idle');
    }
  };

  const stopRecording = async () => {
    setState('stopping');

    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      Alert.alert('Erreur', 'Service d\'enregistrement non initialisé');
      setState('idle');
      return;
    }

    // Stop expo-audio recording (external lib - try/catch allowed)
    try {
      await audioRecorder.stop();
    } catch (error) {
      console.error('[CaptureScreen] Audio recorder stop error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', 'Impossible d\'arrêter l\'enregistrement audio: ' + errorMessage);
      setState('idle');
      return;
    }

    // Get recording info from expo-audio
    const uri = audioRecorder.uri;
    // Use our manually tracked duration instead of recorderState (disabled to avoid iOS crash)
    // recordingDuration is in seconds, convert to milliseconds
    const durationMs = recordingDuration * 1000;

    if (!uri) {
      Alert.alert('Erreur', 'Aucun fichier audio disponible');
      setState('idle');
      return;
    }

    // Stop RecordingService
    const stopResult = await recordingService.stopRecording(uri, durationMs);

    if (stopResult.type !== 'success' || !stopResult.data) {
      console.error('[CaptureScreen] Failed to stop recording:', stopResult.type, stopResult.error);
      Alert.alert('Erreur', stopResult.error ?? 'Impossible de sauvegarder la capture');
      setState('idle');
      return;
    }

    // Move audio file from temp to permanent storage
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

      // Update capture with file metadata AND set state='captured'
      // IMPORTANT: Setting state='captured' HERE (after file move) ensures that
      // the CaptureRecorded event is published with the permanent path, not the temp path.
      // This triggers transcription with the correct file location.
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
      `Durée: ${Math.floor(stopResult.data.duration / 1000)}s\n\nLa capture a été sauvegardée localement.\nLa transcription sera disponible bientôt.`,
      [{ text: 'OK' }]
    );

    setState('idle');
  };

  /**
   * Story 2.3: Cancel recording with immediate stop
   * AC1: Cancel Recording with Immediate Stop
   * - Stops expo-audio recorder
   * - Deletes partial audio file
   * - Removes Capture entity from WatermelonDB
   */
  const cancelRecording = async () => {
    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      Alert.alert('Erreur', 'Service d\'enregistrement non initialisé');
      setState('idle');
      return;
    }

    // AC1: Stop expo-audio recorder FIRST (fixes code review issue #4)
    try {
      await audioRecorder.stop();
    } catch (error) {
      console.error('[CaptureScreen] Failed to stop audio recorder during cancel:', error);
      // Continue with cancel even if stop fails
    }

    // AC1: Delete file + DB entity via RecordingService
    const result = await recordingService.cancelRecording();

    if (result.type !== 'success') {
      console.error('[CaptureScreen] Failed to cancel recording:', result.type, result.error);
      Alert.alert(
        'Attention',
        'L\'enregistrement a été arrêté mais le nettoyage a échoué. Vous pouvez réessayer.',
        [{ text: 'OK' }]
      );
    }

    setState('idle');
  };

  const handleTextCaptureSave = async (text: string): Promise<void> => {
    // AC2: Save text capture using TextCaptureService
    const textCaptureService = textCaptureServiceRef.current;
    if (!textCaptureService) {
      Alert.alert('Erreur', 'Service non initialisé');
      throw new Error('Service non initialisé');
    }

    // Use service layer instead of direct repository access
    const result = await textCaptureService.createTextCapture(text);

    if (result.type !== 'success' || !result.data) {
      const errorMsg = result.error ?? 'Impossible de sauvegarder la capture';
      Alert.alert('Erreur', errorMsg);
      throw new Error(errorMsg);
    }

    // Close modal
    setShowTextCapture(false);

    // Show success message
    Alert.alert(
      'Capture enregistrée!',
      `Votre pensée a été sauvegardée localement.
La synchronisation se fera automatiquement.`,
      [{ text: 'OK' }]
    );
  };

  const handleTextCaptureCancel = () => {
    setShowTextCapture(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pensées Vocales</Text>
        <Text style={styles.subtitle}>
          {state === 'idle'
            ? 'Tap pour enregistrer'
            : state === 'recording'
            ? 'Enregistrement en cours...'
            : 'Sauvegarde...'}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <View style={styles.captureButtons}>
          {/* Story 2.3: RecordButtonUI with cancel functionality */}
          <RecordButtonUI
            onRecordPress={startRecording}
            onStopPress={stopRecording}
            onCancelConfirm={cancelRecording}
            isRecording={state === 'recording'}
            recordingDuration={recordingDuration}
            disabled={state === 'stopping'}
          />

          {/* Text Capture Button - AC1: Distinct icon, 44x44 tap target */}
          <TouchableOpacity
            style={styles.textCaptureButton}
            onPress={() => setShowTextCapture(true)}
            disabled={state !== 'idle'}
            activeOpacity={0.8}
            testID="text-capture-button"
            accessibilityLabel="Capturer du texte"
            accessibilityHint="Ouvre le clavier pour saisir une pensée sous forme de texte"
            accessibilityRole="button"
            accessibilityState={{ disabled: state !== 'idle' }}
          >
            <Text style={styles.textCaptureIcon}>✏️</Text>
            <Text style={styles.textCaptureLabel}>Texte</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          {state === 'idle'
            ? 'Tapez une fois pour commencer\nTapez à nouveau pour arrêter'
            : state === 'recording'
            ? 'Parlez naturellement...'
            : 'Sauvegarde en cours...'}
        </Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#8E8E93',
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  recordButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  textCaptureButton: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#34C759', // Green for text
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  textCaptureIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  textCaptureLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 28,
    textAlignVertical: 'center',
  },
  infoContainer: {
    marginTop: 40,
    alignItems: 'center',
    minHeight: 48, // 2 lignes * lineHeight(24) pour éviter le décalage du bouton
  },
  infoText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionWarning: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    padding: 16,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  permissionSubtext: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  devToolsToggle: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  devToolsToggleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});

// Export the wrapper component that initializes audio mode first
export { CaptureScreenWithAudioMode as CaptureScreen };
