import React, { useState, useEffect } from 'react';
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
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecordingOptions,
  AudioQuality,
  IOSOutputFormat
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useAuthListener } from '../../contexts/identity/hooks/useAuthListener';

type RecordingState = 'idle' | 'recording' | 'stopping';

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
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MAX,
  },
  web: {
    mimeType: 'audio/webm',
  },
};

export const CaptureScreen = () => {
  const { user } = useAuthListener();
  const [state, setState] = useState<RecordingState>('idle');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Use expo-audio hooks
  const audioRecorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(audioRecorder, 100); // Update every 100ms

  // Check permission status on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const { granted } = await getRecordingPermissionsAsync();
    setHasPermission(granted);
  };

  const handleTap = async () => {
    if (state === 'recording') {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      // Check/request permissions
      if (!hasPermission) {
        const result = await requestRecordingPermissionsAsync();

        if (!result.granted) {
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

      // Prepare and start recording
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setState('recording');
    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement: ' + errorMessage);
      setState('idle');
    }
  };

  const stopRecording = async () => {
    try {
      setState('stopping');

      // Stop recording
      await audioRecorder.stop();

      // Get recording info
      const uri = audioRecorder.uri;
      const recordingDuration = recorderState.durationMillis;

      // Verify file exists and get info using new File API
      let fileSize = 0;
      if (uri) {
        try {
          const audioFile = new File(uri);
          fileSize = audioFile.size;
        } catch (error) {
          console.warn('Could not get file info:', error);
        }
      }

      Alert.alert(
        'Capture enregistrée!',
        `Durée: ${Math.floor(recordingDuration / 1000)}s${fileSize ? `\nTaille: ${Math.round(fileSize / 1024)}KB` : ''}\n\nLa transcription sera disponible bientôt.`,
        [{ text: 'OK' }]
      );

      setState('idle');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', 'Impossible d\'arrêter l\'enregistrement: ' + errorMessage);
      setState('idle');
    }
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
            <>
              <Text style={styles.buttonText}>{getButtonText()}</Text>
              {state === 'recording' && (
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                </View>
              )}
            </>
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
  recordingIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
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
});
