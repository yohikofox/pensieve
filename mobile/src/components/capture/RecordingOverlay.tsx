import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';

interface RecordingOverlayProps {
  duration: number;
  onStop: () => void;
  onCancel: () => void;
  isStopping: boolean;
}

/**
 * Format duration in seconds to mm:ss format
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Recording Overlay Component
 * Full-screen overlay displayed during voice recording
 */
export const RecordingOverlay = ({
  duration,
  onStop,
  onCancel,
  isStopping,
}: RecordingOverlayProps) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the recording indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        {/* Recording indicator */}
        <Animated.View
          style={[
            styles.recordingIndicator,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={styles.recordingDot} />
        </Animated.View>

        {/* Status text */}
        <Text style={styles.statusText}>
          {isStopping ? 'Arrêt en cours...' : 'Enregistrement en cours'}
        </Text>

        {/* Duration display */}
        <Text style={styles.duration}>{formatDuration(duration)}</Text>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {isStopping ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                accessibilityLabel="Annuler l'enregistrement"
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={onStop}
                accessibilityLabel="Arrêter l'enregistrement"
                accessibilityRole="button"
              >
                <View style={styles.stopIcon} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  recordingIndicator: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  recordingDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF3B30',
  },
  statusText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 16,
    fontWeight: '500',
  },
  duration: {
    fontSize: 64,
    fontWeight: '200',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    marginBottom: 60,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '500',
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
