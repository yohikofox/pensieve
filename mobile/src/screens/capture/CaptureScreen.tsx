import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { useAuthListener } from '../../contexts/identity/hooks/useAuthListener';

type RecordingState = 'idle' | 'recording' | 'stopping';

export const CaptureScreen = () => {
  const { user } = useAuthListener();
  const [state, setState] = useState<RecordingState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [duration, setDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await Audio.getPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      console.log('🎤 Requesting microphone permission...');
      const { status, canAskAgain, granted } = await Audio.requestPermissionsAsync();
      console.log('Permission result:', { status, canAskAgain, granted });

      setHasPermission(status === 'granted');

      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          canAskAgain
            ? 'Veuillez autoriser l\'accès au microphone pour enregistrer.'
            : 'L\'accès au microphone a été refusé. Activez-le dans les Réglages → Pensieve → Microphone',
          [
            { text: 'Réglages', onPress: () => {
              // Open settings (platform specific)
              console.log('Open settings');
            }},
            { text: 'Annuler', style: 'cancel' }
          ]
        );
      }

      return status === 'granted';
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      Alert.alert('Erreur', 'Impossible de demander la permission: ' + error.message);
      return false;
    }
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
      console.log('🎙️ Starting recording...');
      console.log('Current hasPermission:', hasPermission);

      // Check/request permissions
      if (!hasPermission) {
        console.log('No permission yet, requesting...');
        const granted = await requestPermissions();
        console.log('Permission granted?', granted);
        if (!granted) {
          console.log('❌ Permission not granted, aborting');
          return;
        }
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setState('recording');
      setDuration(0);

      // Update duration every 100ms
      const startTime = Date.now();
      const interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 100);

      // Store interval ID for cleanup
      (newRecording as any)._intervalId = interval;

      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
      setState('idle');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setState('stopping');

      // Clear duration interval
      const intervalId = (recording as any)._intervalId;
      if (intervalId) {
        clearInterval(intervalId);
      }

      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();

      // Save capture (simplified for now)
      console.log('Recording saved:', {
        uri,
        duration: status.durationMillis,
        user: user?.email,
      });

      Alert.alert(
        'Capture enregistrée!',
        `Durée: ${Math.floor((status.durationMillis || 0) / 1000)}s\n\nLa transcription sera disponible bientôt.`,
        [{ text: 'OK' }]
      );

      setRecording(null);
      setState('idle');
      setDuration(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Erreur', 'Impossible d\'arrêter l\'enregistrement');
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
            ? `Enregistrement... ${duration}s`
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

      {!hasPermission && state === 'idle' && (
        <View style={styles.permissionWarning}>
          <Text style={styles.permissionWarningText}>
            ⚠️ Permission microphone requise
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
  },
});
