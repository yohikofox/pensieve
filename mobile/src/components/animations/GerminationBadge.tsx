/**
 * GerminationBadge - Badge with one-time germination animation
 *
 * Story 3.3 AC: Germination animation when capture becomes "ready"
 *
 * Features:
 * - Scale + fade-in animation (organic "sprouting" feel)
 * - Plays once on mount
 * - "Jardin d'idées" metaphor
 */

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface GerminationBadgeProps {
  children: React.ReactNode;
  /** Enable/disable animation (default: true) */
  enabled?: boolean;
}

export function GerminationBadge({ children, enabled = true }: GerminationBadgeProps) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;

    // Germination: scale from 0.3 → 1.0 with spring physics
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      {children}
    </Animated.View>
  );
}
