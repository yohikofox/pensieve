/**
 * SwipeableCard - Card with swipe actions (delete, share, archive)
 *
 * Story 3.4: Swipe actions on capture cards
 *
 * Features:
 * - Swipe right → Delete action (red)
 * - Swipe left → Share action (blue)
 * - Spring physics animation
 * - Haptic feedback on action trigger
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../design-system/tokens';
import { useTheme } from '../../hooks/useTheme';

interface SwipeableCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Delete action callback */
  onDelete?: () => void;
  /** Share action callback */
  onShare?: () => void;
  /** Archive action callback (optional) */
  onArchive?: () => void;
  /** Enable/disable swipe (default: true) */
  enabled?: boolean;
}

export function SwipeableCard({
  children,
  onDelete,
  onShare,
  onArchive,
  enabled = true,
}: SwipeableCardProps) {
  const { isDark } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  // Story 3.4 AC: Right swipe actions (delete)
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!onDelete) return null;

    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    const handleDelete = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      swipeableRef.current?.close();
      onDelete();
    };

    return (
      <Animated.View
        style={[
          styles.actionsContainer,
          {
            transform: [{ translateX: trans }],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.action, styles.deleteAction]}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={20} color="#FFF" />
          <Text style={styles.actionText}>Supprimer</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Story 3.4 AC: Left swipe actions (share, archive)
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!onShare && !onArchive) return null;

    const trans = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [-100, 0],
      extrapolate: 'clamp',
    });

    const handleShare = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      swipeableRef.current?.close();
      onShare?.();
    };

    const handleArchive = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      swipeableRef.current?.close();
      onArchive?.();
    };

    return (
      <Animated.View
        style={[
          styles.actionsContainer,
          {
            transform: [{ translateX: trans }],
          },
        ]}
      >
        {onShare && (
          <TouchableOpacity
            style={[styles.action, styles.shareAction]}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Feather name="share-2" size={20} color="#FFF" />
            <Text style={styles.actionText}>Partager</Text>
          </TouchableOpacity>
        )}
        {onArchive && (
          <TouchableOpacity
            style={[styles.action, styles.archiveAction]}
            onPress={handleArchive}
            activeOpacity={0.7}
          >
            <Feather name="archive" size={20} color="#FFF" />
            <Text style={styles.actionText}>Archiver</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      enableTrackpadTwoFingerGesture
      dragOffsetFromLeftEdge={20}
      dragOffsetFromRightEdge={20}
      failOffsetY={[-15, 15]}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    paddingHorizontal: 12,
  },
  deleteAction: {
    backgroundColor: colors.error[500],
  },
  shareAction: {
    backgroundColor: colors.primary[500],
  },
  archiveAction: {
    backgroundColor: colors.warning[500],
  },
  actionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
