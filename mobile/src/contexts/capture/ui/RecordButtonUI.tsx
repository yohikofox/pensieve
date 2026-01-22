/**
 * RecordButtonUI - Pure UI Component for Audio Recording
 *
 * Story 2.3 Integration: Dumb UI component that delegates all logic to parent
 *
 * This component handles ONLY:
 * - Visual feedback (pulsing animation, colors)
 * - Haptic feedback
 * - Timer display
 * - Cancel button + confirmation dialog
 * - Discard animation
 *
 * Parent (CaptureScreen) handles:
 * - expo-audio recording
 * - RecordingService calls
 * - File storage
 * - Permission checks
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface RecordButtonUIProps {
  /** Called when user taps record button to START recording */
  onRecordPress: () => void;
  /** Called when user taps record button to STOP recording */
  onStopPress: () => void;
  /** Called when user confirms cancel in dialog */
  onCancelConfirm: () => void;
  /** Current recording state from parent */
  isRecording: boolean;
  /** Recording duration in seconds from parent (for timer display) */
  recordingDuration: number;
  /** Whether the button should be disabled (e.g. during 'stopping' state) */
  disabled?: boolean;
}

export const RecordButtonUI: React.FC<RecordButtonUIProps> = ({
  onRecordPress,
  onStopPress,
  onCancelConfirm,
  isRecording,
  recordingDuration,
  disabled = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const discardAnim = useRef(new Animated.Value(1)).current;

  /**
   * AC3: Pulsing animation during recording
   */
  useEffect(() => {
    if (isRecording) {
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
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
    } else {
      // Stop pulsing animation
      pulseAnim.setValue(1);
    }

    return () => {
      pulseAnim.stopAnimation();
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
      onRecordPress();
    } else {
      onStopPress();
    }
  };

  /**
   * Story 2.3: Handle cancel button press with confirmation
   * AC2: Cancel Gesture with Confirmation
   * AC3: Haptic Feedback on Cancellation
   */
  const handleCancel = async () => {
    Alert.alert(
      'Discard this recording?',
      'This recording will be permanently deleted.',
      [
        {
          text: 'Keep Recording',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            // AC3: Haptic feedback on cancellation (Heavy for warning)
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }

            // AC4: Discard animation
            Animated.timing(discardAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              discardAnim.setValue(1);
              onCancelConfirm();
            });
          },
        },
      ]
    );
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
      <Animated.View style={{ opacity: discardAnim, transform: [{ scale: discardAnim }] }}>
        <TouchableOpacity
          testID="record-button"
          onPress={handlePress}
          activeOpacity={0.7}
          disabled={disabled}
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
      </Animated.View>

      {/* Story 2.3 AC1: Cancel button - only visible when recording */}
      {isRecording && (
        <TouchableOpacity
          testID="cancel-button"
          onPress={handleCancel}
          activeOpacity={0.7}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>✕</Text>
        </TouchableOpacity>
      )}
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
  // Story 2.3: Cancel button styles
  cancelButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  cancelButtonText: {
    fontSize: 24,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
