/**
 * SkeletonCaptureCard - Skeleton loader for capture cards
 *
 * Story 3.1 AC7: Show skeleton loading cards with shimmer animation
 *
 * Features:
 * - Mimics the structure of CaptureCard
 * - Smooth shimmer animation (Liquid Glass design)
 * - Dark/light theme support
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { colors } from '../../design-system/tokens';

interface SkeletonCaptureCardProps {
  /** Delay before animation starts (for staggered effect) */
  delay?: number;
}

export function SkeletonCaptureCard({ delay = 0 }: SkeletonCaptureCardProps) {
  const { isDark } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Wait for delay, then start shimmer loop
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [shimmerAnim, delay]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  const skeletonBg = isDark ? colors.neutral[800] : colors.neutral[100];
  const shimmerColor = isDark ? colors.neutral[700] : colors.neutral[200];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
          borderColor: isDark ? colors.neutral[700] : 'transparent',
        },
      ]}
    >
      {/* Header: Icon + Type + Date */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Animated.View
            style={[
              styles.icon,
              { backgroundColor: shimmerColor, opacity: shimmerOpacity },
            ]}
          />
          <Animated.View
            style={[
              styles.typeText,
              { backgroundColor: shimmerColor, opacity: shimmerOpacity },
            ]}
          />
        </View>
        <Animated.View
          style={[
            styles.dateText,
            { backgroundColor: shimmerColor, opacity: shimmerOpacity },
          ]}
        />
      </View>

      {/* Badge */}
      <Animated.View
        style={[
          styles.badge,
          { backgroundColor: shimmerColor, opacity: shimmerOpacity },
        ]}
      />

      {/* Content lines */}
      <View className="gap-2">
        <Animated.View
          style={[
            styles.contentLine,
            styles.fullLine,
            { backgroundColor: shimmerColor, opacity: shimmerOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.contentLine,
            styles.fullLine,
            { backgroundColor: shimmerColor, opacity: shimmerOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.contentLine,
            styles.shortLine,
            { backgroundColor: shimmerColor, opacity: shimmerOpacity },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Pas de borderWidth ni d'elevation : le skeleton est un placeholder temporaire.
    // borderWidth: 1 + elevation sur Android créaient une bordure sombre visible
    // lors du premier frame de rendu, avant le démarrage de l'animation shimmer.
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  typeText: {
    width: 60,
    height: 16,
    borderRadius: 4,
  },
  dateText: {
    width: 80,
    height: 14,
    borderRadius: 4,
  },
  badge: {
    width: 100,
    height: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  // content: migrated to NativeWind className="gap-2"
  contentLine: {
    height: 14,
    borderRadius: 4,
  },
  fullLine: {
    width: '100%',
  },
  shortLine: {
    width: '70%',
  },
});
