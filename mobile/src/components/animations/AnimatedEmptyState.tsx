import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface AnimatedEmptyStateProps {
  children: React.ReactNode;
  enabled?: boolean; // Default: true, disable if reduce motion
}

export function AnimatedEmptyState({
  children,
  enabled = true
}: AnimatedEmptyStateProps) {
  const breathingScale = useRef(new Animated.Value(1)).current;
  // Start at 0.7 opacity for subtle breathing effect (inhale to 1.0, exhale to 0.7)
  const breathingOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!enabled) return;

    // Gentle breathing cycle: 3000ms (slower than PulsingBadge)
    const breathingAnimation = Animated.loop(
      Animated.parallel([
        // Scale animation (subtle)
        Animated.sequence([
          Animated.timing(breathingScale, {
            toValue: 1.08,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breathingScale, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        // Opacity animation (respiratory effect)
        Animated.sequence([
          Animated.timing(breathingOpacity, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breathingOpacity, {
            toValue: 0.7,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    breathingAnimation.start();

    return () => breathingAnimation.stop();
  }, [enabled]); // Only `enabled` needed - Animated.Values don't change reference

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Animated.View
      style={{
        transform: [{ scale: breathingScale }],
        opacity: breathingOpacity,
      }}
    >
      {children}
    </Animated.View>
  );
}
