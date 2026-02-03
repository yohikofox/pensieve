/**
 * AnimatedCaptureCard - Animated wrapper for capture cards
 *
 * Story 3.4 - Task 2: Scroll Appearance Animations (AC4)
 *
 * Features:
 * - Staggered fade-in animation (germination metaphor)
 * - Subtle slide-up from bottom
 * - 50ms delay per item for organic feel
 * - GPU accelerated with useNativeDriver
 * - 60fps performance target
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface AnimatedCaptureCardProps {
  children: React.ReactNode;
  index: number;
  /** Enable/disable animation (useful for instant rendering on mount) */
  enabled?: boolean;
}

export function AnimatedCaptureCard({
  children,
  index,
  enabled = true
}: AnimatedCaptureCardProps) {
  const opacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(enabled ? 20 : 0)).current;

  useEffect(() => {
    if (!enabled) return;

    // Staggered animation: 50ms delay per item for organic germination feel
    const delay = index * 50;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true, // GPU acceleration for 60fps
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        tension: 50,
        friction: 7,
        useNativeDriver: true, // GPU acceleration for 60fps
      }),
    ]).start();
  }, [enabled, index, opacity, translateY]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
