/**
 * RecordButton Component - 1-Tap Audio Capture UI
 *
 * Implements AC1 requirements:
 * - < 500ms latency from tap to recording start
 * - Visual feedback (pulsing red indicator)
 * - Haptic feedback on iOS/Android
 * - Recording duration timer
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC1: Start Recording with < 500ms Latency
 * AC2: Stop and Save Recording
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { container } from 'tsyringe';
import { RecordingService } from '../services/RecordingService';
import { RepositoryResultType } from '../domain/Result';

interface RecordButtonProps {
  onRecordingStart?: (captureId: string) => void;
  onRecordingStop?: (result: {
    captureId: string;
    filePath: string;
    duration: number;
  }) => void;
  onError?: (error: string) => void;
}

/**
 * RecordButton - Main UI component for audio capture
 *
 * Usage:
 * ```tsx
 * <RecordButton
 *   onRecordingStart={(id) => console.log('Recording started:', id)}
 *   onRecordingStop={(result) => console.log('Recording saved:', result)}
 *   onError={(error) => console.error('Recording error:', error)}
 * />
 * ```
 */
export const RecordButton: React.FC<RecordButtonProps> = ({
  onRecordingStart,
  onRecordingStop,
  onError,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingService = useRef(container.resolve(RecordingService)).current;

  // AC1: Pulsing red indicator animation during recording
  useEffect(() => {
    if (isRecording) {
      // Start pulsing animation
      Animated.loop(
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
      ).start();

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      // Stop pulsing animation
      pulseAnim.setValue(1);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, pulseAnim]);

  /**
   * AC1: Handle record button press with haptic feedback
   */
  const handlePress = async () => {
    // AC1: Haptic feedback on tap (iOS/Android)
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!isRecording) {
      // Start recording
      const result = await recordingService.startRecording();

      if (result.type === RepositoryResultType.SUCCESS && result.data) {
        setIsRecording(true);
        onRecordingStart?.(result.data.captureId);
      } else {
        const errorMessage = result.error || 'Failed to start recording';
        onError?.(errorMessage);
      }
    } else {
      // Stop recording
      const result = await recordingService.stopRecording();

      if (result.type === RepositoryResultType.SUCCESS && result.data) {
        setIsRecording(false);
        onRecordingStop?.(result.data);
      } else {
        const errorMessage = result.error || 'Failed to stop recording';
        onError?.(errorMessage);
        setIsRecording(false);
      }
    }
  };

  /**
   * Format recording duration as MM:SS
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        testID="record-button"
        onPress={handlePress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.button,
            isRecording ? styles.recording : styles.idle,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          {isRecording && <View style={styles.recordingDot} />}
        </Animated.View>
      </TouchableOpacity>

      {/* AC1: Recording duration timer */}
      {isRecording && (
        <Text style={styles.timer}>{formatDuration(recordingDuration)}</Text>
      )}

      {/* Button label */}
      <Text style={styles.label}>
        {isRecording ? 'Tap to Stop' : 'Tap to Record'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchable: {
    padding: 10,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    // Elevation for Android
    elevation: 5,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  idle: {
    backgroundColor: '#FF3B30', // iOS red
  },
  recording: {
    backgroundColor: '#FF3B30',
    borderWidth: 4,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  recordingDot: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  timer: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: '600',
    color: '#FF3B30',
    fontVariant: ['tabular-nums'], // Monospaced numbers
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93', // iOS secondary label
    fontWeight: '500',
  },
});
