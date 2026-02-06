/**
 * FilterTabs Component
 * Story 5.3 - AC1, Task 2: Filter tabs with count badges
 *
 * Displays 3 filter tabs: Toutes | À faire | Faites
 * - Active tab highlighted with Liquid Glass style
 * - Count badges on each tab
 * - Haptic feedback on press
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FilterType } from '../hooks/useFilterState';
import { settingsStore } from '../../../stores/settingsStore';
import { useTheme } from '../../../hooks/useTheme';
import { colors } from '../../../design-system/tokens';

export interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: {
    all: number;
    active: number;
    completed: number;
  };
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  activeFilter,
  onFilterChange,
  counts,
}) => {
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const handleTabPress = async (filter: FilterType) => {
    // Haptic feedback (check user preference)
    if (settingsStore.hapticFeedbackEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    onFilterChange(filter);
  };

  return (
    <View style={styles.container}>
      {/* Tab: Toutes */}
      <TouchableOpacity
        testID="filter-tab-all"
        style={[styles.tab, activeFilter === 'all' && styles.tabActive]}
        onPress={() => handleTabPress('all')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeFilter === 'all' }}
        accessibilityLabel={`Toutes les actions (${counts.all})`}
      >
        <Text
          style={[styles.tabText, activeFilter === 'all' && styles.tabTextActive]}
        >
          Toutes
        </Text>
        <View
          style={[
            styles.badge,
            activeFilter === 'all' && styles.badgeActive,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              activeFilter === 'all' && styles.badgeTextActive,
            ]}
          >
            {counts.all}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Tab: À faire */}
      <TouchableOpacity
        testID="filter-tab-active"
        style={[styles.tab, activeFilter === 'active' && styles.tabActive]}
        onPress={() => handleTabPress('active')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeFilter === 'active' }}
        accessibilityLabel={`À faire (${counts.active})`}
      >
        <Text
          style={[
            styles.tabText,
            activeFilter === 'active' && styles.tabTextActive,
          ]}
        >
          À faire
        </Text>
        <View
          style={[
            styles.badge,
            activeFilter === 'active' && styles.badgeActive,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              activeFilter === 'active' && styles.badgeTextActive,
            ]}
          >
            {counts.active}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Tab: Faites */}
      <TouchableOpacity
        testID="filter-tab-completed"
        style={[styles.tab, activeFilter === 'completed' && styles.tabActive]}
        onPress={() => handleTabPress('completed')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeFilter === 'completed' }}
        accessibilityLabel={`Faites (${counts.completed})`}
      >
        <Text
          style={[
            styles.tabText,
            activeFilter === 'completed' && styles.tabTextActive,
          ]}
        >
          Faites
        </Text>
        <View
          style={[
            styles.badge,
            activeFilter === 'completed' && styles.badgeActive,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              activeFilter === 'completed' && styles.badgeTextActive,
            ]}
          >
            {counts.completed}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
      gap: 6,
    },
    tabActive: {
      backgroundColor: isDark ? colors.primary[900] : colors.primary[50],
      borderWidth: 1.5,
      borderColor: isDark ? colors.primary[400] : colors.primary[500],
      // Liquid Glass elevated effect
      shadowColor: isDark ? colors.primary[400] : colors.primary[500],
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.neutral[300] : colors.neutral[500],
    },
    tabTextActive: {
      color: isDark ? colors.primary[300] : colors.primary[600],
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: isDark ? colors.neutral[600] : colors.neutral[300],
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeActive: {
      backgroundColor: isDark ? colors.primary[500] : colors.primary[500],
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? colors.neutral[200] : colors.neutral[700],
    },
    badgeTextActive: {
      color: colors.neutral[0],
    },
  });
