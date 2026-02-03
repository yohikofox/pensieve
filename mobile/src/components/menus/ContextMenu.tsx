/**
 * ContextMenu - Long-press contextual menu for captures
 *
 * Story 3.4 - Task 3: Long-Press Contextual Menu (AC5)
 *
 * Features:
 * - Triggers on 300ms long-press
 * - Backdrop blur effect (Liquid Glass design)
 * - Medium haptic feedback on activation
 * - Smooth scale animation on appearance
 * - Menu options: Share, Delete, Pin, Favorite
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../design-system/tokens';
import { useTheme } from '../../hooks/useTheme';

export interface ContextMenuOption {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  options: ContextMenuOption[];
}

export function ContextMenu({ visible, onClose, options }: ContextMenuProps) {
  const { isDark } = useTheme();
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Trigger haptic feedback on menu open
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Animate menu appearance with scale + fade
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animation values
      scale.setValue(0.8);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop with blur (Liquid Glass effect) */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          testID="context-menu-blur"
        />

        {/* Menu container */}
        <Animated.View
          style={[
            styles.menuContainer,
            {
              transform: [{ scale }],
              opacity,
            },
          ]}
          testID="context-menu"
        >
          <View
            style={[
              styles.menu,
              {
                backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
                borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
              },
            ]}
          >
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuOption,
                  index < options.length - 1 && styles.menuOptionBorder,
                  {
                    borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200],
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  option.onPress();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Feather
                  name={option.icon}
                  size={20}
                  color={
                    option.variant === 'danger'
                      ? colors.error[500]
                      : isDark
                      ? colors.neutral[200]
                      : colors.neutral[700]
                  }
                  style={styles.menuIcon}
                />
                <Text
                  style={[
                    styles.menuLabel,
                    {
                      color:
                        option.variant === 'danger'
                          ? colors.error[500]
                          : isDark
                          ? colors.neutral[100]
                          : colors.neutral[800],
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: 250,
  },
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuOptionBorder: {
    borderBottomWidth: 1,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
