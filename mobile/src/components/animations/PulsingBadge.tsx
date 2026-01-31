/**
 * PulsingBadge - Badge with subtle pulsing animation
 *
 * Story 3.3 AC: Pulsing animation on "in progress" badges
 *
 * Features:
 * - Subtle scale + opacity pulsing effect
 * - Liquid Glass design aesthetic
 * - Wraps existing Badge component
 */

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface PulsingBadgeProps {
  children: React.ReactNode;
  /** Enable/disable pulsing (default: true) */
  enabled?: boolean;
}

export function PulsingBadge({ children, enabled = true }: PulsingBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) return;

    // Subtle pulsing loop (scale 1.0 → 1.05 → 1.0)
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [pulseAnim, enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Animated.View
      style={{
        transform: [{ scale: pulseAnim }],
      }}
    >
      {children}
    </Animated.View>
  );
}
