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

    // opacity — JS driver (useNativeDriver: false) :
    // Avec native driver, l'opacité initiale 0 n'est appliquée qu'après le premier
    // frame du RenderThread Android (race condition). Pendant ce frame, la Card
    // rend à opacité 1 → elevation shadow visible comme une bordure.
    // Le JS driver applique opacity:0 de façon synchrone dès le premier rendu,
    // sans décalage. Les deux valeurs ne peuvent pas coexister sur le même
    // Animated.View → vues imbriquées ci-dessous.
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      delay,
      useNativeDriver: false,
    }).start();

    // translateY — native driver : transform 60fps sur le RenderThread
    Animated.spring(translateY, {
      toValue: 0,
      delay,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [enabled, index, opacity, translateY]);

  if (!enabled) {
    return <>{children}</>;
  }

  // opacity (JS driver) et transform (native driver) ne peuvent pas être sur le
  // même Animated.View → vue externe pour opacity, vue interne pour transform.
  return (
    <Animated.View style={{ opacity }}>
      <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
