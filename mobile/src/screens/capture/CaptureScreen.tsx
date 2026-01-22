import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingOptions,
} from 'expo-audio';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import { useAuthListener } from '../../contexts/identity/hooks/useAuthListener';
import { RecordingService } from '../../contexts/capture/services/RecordingService';
import { CrashRecoveryService } from '../../contexts/capture/services/CrashRecoveryService';
import { FileStorageService } from '../../contexts/capture/services/FileStorageService';
import type { ICaptureRepository } from '../../contexts/capture/domain/ICaptureRepository';
import type { IPermissionService } from '../../contexts/capture/domain/IPermissionService';
import { CaptureDevTools } from '../../components/dev/CaptureDevTools';

type RecordingState = 'idle' | 'recording' | 'stopping';

/**
 * Recording options for expo-audio (SDK 54)
 * High quality M4A/AAC format compatible with Whisper transcription
 */
const recordingOptions: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 2,
  bitRate: 128000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: 'mpeg4', // SDK 54: use string instead of IOSOutputFormat enum
  },
  web: {
    mimeType: 'audio/webm',
  },
};

export const CaptureScreen = () => {
  const { user } = useAuthListener();
  const [state, setState] = useState<RecordingState>('idle');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);

  // Use expo-audio hooks for actual recording
  const audioRecorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(audioRecorder, 100); // Update every 100ms

  // Use RecordingService for business logic and persistence (via TSyringe)
  const recordingServiceRef = useRef<RecordingService | null>(null);
  const repositoryRef = useRef<ICaptureRepository | null>(null);
  const permissionServiceRef = useRef<IPermissionService | null>(null);
  const fileStorageServiceRef = useRef<FileStorageService | null>(null);

  // Initialize services on mount via TSyringe container
  useEffect(() => {
    recordingServiceRef.current = container.resolve(RecordingService);
    repositoryRef.current = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
    permissionServiceRef.current = container.resolve<IPermissionService>(TOKENS.IPermissionService);
    fileStorageServiceRef.current = container.resolve(FileStorageService);
  }, []);

  // Check permission status on mount
  useEffect(() => {
    checkPermissions();
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

  const checkPermissions = async () => {
    if (!permissionServiceRef.current) return;
    const hasPermission = await permissionServiceRef.current.hasMicrophonePermission();
    setHasPermission(hasPermission);
  };

  const handleTap = async () => {
    if (state === 'recording') {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    const recordingService = recordingServiceRef.current;
    if (!recordingService) {
      Alert.alert('Erreur', 'Service d\'enregistrement non initialisé');
      setState('idle');
      return;
    }

    // Check/request permissions
    if (!hasPermission && permissionServiceRef.current) {
      const result = await permissionServiceRef.current.requestMicrophonePermission();

      if (result.status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          result.canAskAgain
            ? 'Veuillez autoriser l\'accès au microphone pour enregistrer.'
            : 'L\'accès au microphone a été refusé. Activez-le dans Réglages → Pensieve → Microphone',
          [{ text: 'OK' }]
        );
        return;
      }

      setHasPermission(true);
    }

    // Prepare expo-audio recording FIRST to get temporary file URI (external lib - try/catch allowed)
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
    const recordingDuration = recorderState.durationMillis;

    if (!uri) {
      Alert.alert('Erreur', 'Aucun fichier audio disponible');
      setState('idle');
      return;
    }

    // Stop RecordingService
    const stopResult = await recordingService.stopRecording(uri, recordingDuration);

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

      // Update capture with file metadata
      const updateResult = await repositoryRef.current.update(stopResult.data.captureId, {
        rawContent: storageResult.data.permanentPath,
        duration: storageResult.data.metadata.duration,
        fileSize: storageResult.data.metadata.size,
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

  const getButtonText = () => {
    if (state === 'recording') {
      return 'Arrêter';
    }
    if (state === 'stopping') {
      return 'Enregistrement...';
    }
    return 'Capturer';
  };

  const getButtonColor = () => {
    if (state === 'recording') {
      return '#FF3B30'; // Red
    }
    if (state === 'stopping') {
      return '#8E8E93'; // Gray
    }
    return '#007AFF'; // Blue
  };

  // Show DevTools if toggled
  if (showDevTools) {
    return (
      <View style={styles.container}>
        <CaptureDevTools />
        <TouchableOpacity
          style={styles.devToolsToggle}
          onPress={() => setShowDevTools(false)}
        >
          <Text style={styles.devToolsToggleText}>📱 Retour UI</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pensées Vocales</Text>
        <Text style={styles.subtitle}>
          {state === 'idle'
            ? 'Tap pour enregistrer'
            : state === 'recording'
            ? `Enregistrement... ${Math.floor(recorderState.durationMillis / 1000)}s`
            : 'Sauvegarde...'}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.recordButton, { backgroundColor: getButtonColor() }]}
          onPress={handleTap}
          disabled={state === 'stopping'}
          activeOpacity={0.8}
        >
          {state === 'stopping' ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{getButtonText()}</Text>
          )}
        </TouchableOpacity>
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

      {hasPermission === false && state === 'idle' && (
        <View style={styles.permissionWarning}>
          <Text style={styles.permissionWarningText}>
            ⚠️ Permission microphone requise
          </Text>
          <Text style={styles.permissionSubtext}>
            Tapez "Capturer" pour autoriser
          </Text>
        </View>
      )}

      {/* DevTools toggle button - Development only */}
      <TouchableOpacity
        style={styles.devToolsToggle}
        onPress={() => setShowDevTools(true)}
      >
        <Text style={styles.devToolsToggleText}>🔍 DB</Text>
      </TouchableOpacity>
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
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  infoContainer: {
    marginTop: 40,
    alignItems: 'center',
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
