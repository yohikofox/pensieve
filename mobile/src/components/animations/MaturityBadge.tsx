/**
 * MaturityBadge - Visual maturity indicator for "Jardin d'idées" metaphor
 *
 * Story 3.4 - Task 5: "Jardin d'idées" Visual Maturity (AC7)
 *
 * Features:
 * - Calculate maturity level based on capture age
 * - Display subtle visual indicators (border glow, icon)
 * - Contemplative color palette (calming, not anxious)
 * - Three maturity levels:
 *   - new: < 1 day old (fresh green glow)
 *   - growing: 1-7 days old (blue glow)
 *   - mature: > 7 days old (warm amber glow)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../design-system/tokens';
import { useTheme } from '../../hooks/useTheme';

type MaturityLevel = 'new' | 'growing' | 'mature';

interface MaturityBadgeProps {
  capturedAt: Date;
  variant?: 'full' | 'minimal'; // full = border glow + icon, minimal = icon only
  showLabel?: boolean;
}

/**
 * Calculate maturity level based on capture age
 *
 * @param capturedAt - Capture creation date
 * @returns Maturity level: 'new', 'growing', or 'mature'
 */
export function getMaturityLevel(capturedAt: Date): MaturityLevel {
  const ageInDays = (Date.now() - capturedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays < 1) return 'new';
  if (ageInDays < 7) return 'growing';
  return 'mature';
}

/**
 * Get maturity visual configuration
 *
 * Returns colors and icon for each maturity level following
 * the "Jardin d'idées" contemplative aesthetic.
 */
function getMaturityConfig(level: MaturityLevel, isDark: boolean) {
  const configs = {
    new: {
      borderColor: isDark ? colors.success[600] : colors.success[300],
      backgroundColor: isDark ? colors.success[950] : colors.success[50],
      iconColor: isDark ? colors.success[400] : colors.success[600],
      icon: 'sunrise' as const, // Germination, new beginning
      label: 'Nouvelle',
    },
    growing: {
      borderColor: isDark ? colors.primary[600] : colors.primary[300],
      backgroundColor: isDark ? colors.primary[950] : colors.primary[50],
      iconColor: isDark ? colors.primary[400] : colors.primary[600],
      icon: 'wind' as const, // Growth, expansion
      label: 'En croissance',
    },
    mature: {
      borderColor: isDark ? colors.warning[600] : colors.warning[300],
      backgroundColor: isDark ? colors.warning[950] : colors.warning[50],
      iconColor: isDark ? colors.warning[400] : colors.warning[600],
      icon: 'archive' as const, // Maturity, wisdom, archives
      label: 'Mature',
    },
  };

  return configs[level];
}

/**
 * MaturityBadge Component
 *
 * Displays a subtle visual indicator of capture maturity
 * following the "Jardin d'idées" contemplative aesthetic.
 */
export function MaturityBadge({
  capturedAt,
  variant = 'minimal',
  showLabel = false,
}: MaturityBadgeProps) {
  const { isDark } = useTheme();
  const level = getMaturityLevel(capturedAt);
  const config = getMaturityConfig(level, isDark);

  if (variant === 'minimal') {
    // Minimal variant: icon only with subtle glow
    return (
      <View
        style={[
          styles.minimalContainer,
          {
            backgroundColor: config.backgroundColor,
          },
        ]}
      >
        <Feather name={config.icon} size={14} color={config.iconColor} />
      </View>
    );
  }

  // Full variant: border glow + icon + optional label
  return (
    <View
      style={[
        styles.fullContainer,
        {
          borderColor: config.borderColor,
          backgroundColor: config.backgroundColor,
        },
      ]}
    >
      <Feather name={config.icon} size={14} color={config.iconColor} />
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              color: config.iconColor,
              marginLeft: 6,
            },
          ]}
        >
          {config.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  minimalContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
