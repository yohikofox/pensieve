/**
 * CompletionAnimation Component - Celebration animation for completing todos
 *
 * Story 5.1 - Task 8: Completion Animation (AC8)
 * Subtask 8.3: Implement completion animation component
 * Subtask 8.4: Trigger animation on checkbox toggle (only when marking complete)
 * Subtask 8.5: Ensure 60fps performance (Liquid Glass requirement)
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';

interface CompletionAnimationProps {
  isCompleted: boolean;
  children: React.ReactNode;
}

/**
 * CompletionAnimation - Wraps checkbox and triggers celebration when marking complete
 *
 * Animation style: Checkmark burst with scale pulse and subtle glow
 * Performance: 60fps using Reanimated worklets on UI thread
 *
 * Subtask 8.3: Scale pulse (1.0 → 1.3 → 1.0) with spring physics
 * Subtask 8.5: Runs on UI thread for guaranteed 60fps
 */
export const CompletionAnimation: React.FC<CompletionAnimationProps> = ({
  isCompleted,
  children,
}) => {
  // Animated values for scale and glow
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (isCompleted) {
      // Subtask 8.4: Only trigger when marking complete (not uncomplete)
      // Scale pulse: 1.0 → 1.3 → 1.0 with spring bounce
      scale.value = withSequence(
        withSpring(1.3, {
          damping: 8,
          stiffness: 200,
        }),
        withSpring(1.0, {
          damping: 10,
          stiffness: 150,
        })
      );

      // Green glow: 0 → 1 → 0 (fade in/out)
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 150 }),
        withTiming(0, { duration: 300 })
      );
    } else {
      // Reset when unchecking (no animation)
      scale.value = 1;
      glowOpacity.value = 0;
    }
  }, [isCompleted]);

  // Animated checkbox style (scale pulse)
  const animatedCheckboxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Animated glow style (green ring around checkbox)
  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Green glow background (appears briefly on completion) */}
      <Animated.View style={[styles.glow, animatedGlowStyle]} />

      {/* Checkbox with scale animation */}
      <Animated.View style={animatedCheckboxStyle}>{children}</Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981', // green-500 for success
  },
});
