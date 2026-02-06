/**
 * GardenCelebrationAnimation Component
 * Story 5.4 - Task 4: "Jardin d'idées" Celebration Animation (AC9)
 *
 * Seed sprout animation - green shoot grows upward when todo is completed
 * Subtle, celebratory, not disruptive
 * Duration: 600ms (AC9)
 * 60fps performance with Reanimated on UI thread
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface GardenCelebrationAnimationProps {
  /** Trigger the animation when this becomes true */
  trigger: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
}

/**
 * Seed Sprout Animation (Jardin d'idées metaphor)
 *
 * Animation flow:
 * 1. Seed appears (scale up)
 * 2. Green shoot grows upward (translateY + scale)
 * 3. Small leaves unfold (scale X)
 * 4. Fade out after celebration
 *
 * Total duration: ~600ms (celebratory but not disruptive)
 */
export const GardenCelebrationAnimation: React.FC<GardenCelebrationAnimationProps> = ({
  trigger,
  onComplete,
}) => {
  // Animated values
  const seedScale = useSharedValue(0);
  const shootHeight = useSharedValue(0);
  const leavesScale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (trigger) {
      // Reset all values
      seedScale.value = 0;
      shootHeight.value = 0;
      leavesScale.value = 0;
      opacity.value = 1;

      // Sequence of animations (total ~600ms)

      // 1. Seed appears (100ms)
      seedScale.value = withSpring(1, {
        damping: 10,
        stiffness: 200,
      });

      // 2. Shoot grows (250ms, delayed 100ms)
      shootHeight.value = withDelay(
        100,
        withTiming(1, {
          duration: 250,
          easing: Easing.out(Easing.cubic),
        })
      );

      // 3. Leaves unfold (150ms, delayed 300ms)
      leavesScale.value = withDelay(
        300,
        withTiming(1, {
          duration: 150,
          easing: Easing.out(Easing.ease),
        })
      );

      // 4. Fade out (200ms, delayed 450ms)
      opacity.value = withDelay(
        450,
        withTiming(
          0,
          {
            duration: 200,
            easing: Easing.out(Easing.ease),
          },
          (finished) => {
            if (finished && onComplete) {
              onComplete();
            }
          }
        )
      );
    }
  }, [trigger]);

  // Animated styles for seed (brown circle at bottom)
  const animatedSeedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: seedScale.value }],
    opacity: opacity.value,
  }));

  // Animated styles for shoot (green vertical line)
  const animatedShootStyle = useAnimatedStyle(() => ({
    height: shootHeight.value * 30, // 30px max height
    opacity: opacity.value,
  }));

  // Animated styles for leaves (two green ovals)
  const animatedLeavesStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: leavesScale.value }],
    opacity: opacity.value,
  }));

  if (!trigger) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Leaves (at top of shoot) */}
      <Animated.View style={[styles.leaves, animatedLeavesStyle]}>
        <View style={[styles.leaf, styles.leafLeft]} />
        <View style={[styles.leaf, styles.leafRight]} />
      </Animated.View>

      {/* Shoot (green vertical line) */}
      <Animated.View style={[styles.shoot, animatedShootStyle]} />

      {/* Seed (brown circle at bottom) */}
      <Animated.View style={[styles.seed, animatedSeedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -30,
    // CODE REVIEW FIX #11: Improved centering using alignSelf instead of magic numbers
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 40,
    width: 20,
  },
  seed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#92400e', // brown-800 for seed
    position: 'absolute',
    bottom: 0,
  },
  shoot: {
    width: 3,
    backgroundColor: '#16a34a', // green-600 for shoot
    borderRadius: 1.5,
    position: 'absolute',
    bottom: 6,
  },
  leaves: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 10,
  },
  leaf: {
    width: 8,
    height: 5,
    backgroundColor: '#22c55e', // green-500 for leaves
    borderRadius: 4,
  },
  leafLeft: {
    marginRight: 2,
    transform: [{ rotate: '-30deg' }],
  },
  leafRight: {
    marginLeft: 2,
    transform: [{ rotate: '30deg' }],
  },
});
