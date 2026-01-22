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

            // Call parent immediately - no discard animation
            // Fix: Removed discardAnim to prevent white square + shadow artifacts
            onCancelConfirm();
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

      {/* Absolute positioned block: timer + cancel button - doesn't affect layout */}
      {isRecording && (
        <View style={styles.timerBlock}>
          <Text style={styles.timer}>{formatDuration(recordingDuration)}</Text>

          {/* Story 2.3 AC1: Cancel button - below timer */}
          <TouchableOpacity
            testID="cancel-button"
            onPress={handleCancel}
            activeOpacity={0.7}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Button label - absolute positioned so it doesn't affect record button alignment */}
      <Text style={[styles.label, isRecording ? styles.labelRecording : styles.labelIdle]}>
        {isRecording ? 'Tap to Stop' : 'Tap to Record'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', // Fix timer alignment
    paddingHorizontal: 20, // Prevent overflow
  },
  touchable: {
    padding: 10,
  },
  timerBlock: {
    position: 'absolute',
    top: 110, // Position below record button (80px height + 20px padding + 10px gap)
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 12,
    height: 12,
    borderRadius: 6, // Fully round
    backgroundColor: '#FFFFFF',
  },
  timer: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FF3B30',
    fontVariant: ['tabular-nums'], // Monospaced numbers
  },
  label: {
    position: 'absolute',
    fontSize: 14,
    color: '#8E8E93', // iOS secondary label
    fontWeight: '500',
  },
  labelIdle: {
    top: 110, // Closer to button when not recording
  },
  labelRecording: {
    top: 210, // Below timerBlock when recording
  },
  // Story 2.3: Cancel button styles - positioned below timer in timerBlock
  cancelButton: {
    marginTop: 12, // Space between timer and cancel button
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  cancelButtonText: {
    fontSize: 20,
    color: '#FF3B30',
    fontWeight: '600',
    lineHeight: 20, // Better vertical centering
  },
});
