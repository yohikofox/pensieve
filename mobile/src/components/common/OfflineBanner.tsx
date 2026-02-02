/**
 * OfflineBanner - Network Status Banner
 *
 * Story 3.1 - AC3: Offline Feed Access
 *
 * Shows a subtle banner when the device is offline.
 * Automatically dismisses when back online.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { useTheme } from '../../hooks/useTheme';
import { colors } from '../../design-system/tokens';

interface OfflineBannerProps {
  /** Custom message to display */
  message?: string;
}

export function OfflineBanner({
  message = 'Mode hors-ligne - Vos captures sont sauvegardées',
}: OfflineBannerProps) {
  const { isOffline } = useNetworkStatus();
  const { isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOffline) {
      // Slide in and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out and fade out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOffline, slideAnim, opacityAnim]);

  if (!isOffline) {
    return null;
  }

  const backgroundColor = isDark ? colors.warning[900] : colors.warning[50];
  const textColor = isDark ? colors.warning[200] : colors.warning[800];
  const iconColor = isDark ? colors.warning[400] : colors.warning[600];
  const borderColor = isDark ? colors.warning[700] : colors.warning[200];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          borderBottomColor: borderColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Feather name="wifi-off" size={16} color={iconColor} />
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
});
