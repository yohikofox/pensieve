/**
 * SortMenu Component
 * Story 5.3 - AC5, Task 5: Sort options menu
 *
 * Displays 4 sort options: Default | Priority | Created Date | Alphabetical
 * - Current sort option highlighted with checkmark
 * - Haptic feedback on selection
 * - Modal/bottom sheet presentation
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SortType } from '../hooks/useFilterState';
import { settingsStore } from '../../../stores/settingsStore';
import { useTheme } from '../../../hooks/useTheme';
import {
  colors,
  getPrimaryPaletteForColorScheme,
  getBackgroundColorsForColorScheme,
} from '../../../design-system/tokens';

export interface SortMenuProps {
  visible: boolean;
  onClose: () => void;
  activeSort: SortType;
  onSortChange: (sort: SortType) => void;
}

interface SortOption {
  value: SortType;
  label: string;
  description: string;
}

const SORT_OPTIONS: SortOption[] = [
  {
    value: 'default',
    label: 'Par défaut',
    description: 'Groupées par échéance',
  },
  {
    value: 'priority',
    label: 'Par priorité',
    description: 'Haute → Moyenne → Basse',
  },
  {
    value: 'createdDate',
    label: 'Par date de création',
    description: 'Plus récentes en premier',
  },
  {
    value: 'alphabetical',
    label: 'Alphabétique',
    description: 'A → Z',
  },
];

export const SortMenu: React.FC<SortMenuProps> = ({
  visible,
  onClose,
  activeSort,
  onSortChange,
}) => {
  const { isDark, colorSchemePreference } = useTheme();
  const styles = useMemo(() => createStyles(isDark, colorSchemePreference), [isDark, colorSchemePreference]);

  const handleSortSelect = async (sort: SortType) => {
    // Haptic feedback (check user preference)
    if (settingsStore.hapticFeedbackEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    onSortChange(sort);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Bottom sheet container */}
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.handle} />
              <Text style={styles.title}>Trier par</Text>
            </View>

            {/* Sort options */}
            <View style={styles.options}>
              {SORT_OPTIONS.map((option) => {
                const isActive = activeSort === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => handleSortSelect(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={`${option.label}: ${option.description}`}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </View>

                    {/* Checkmark for active option */}
                    {isActive && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkIcon}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (isDark: boolean, colorScheme: import('../../../design-system/tokens').ColorScheme) => {
  const primaryPalette = getPrimaryPaletteForColorScheme(colorScheme);
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: backgrounds.elevated,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
      shadowColor: colors.neutral[1000],
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    header: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? colors.neutral[600] : colors.neutral[300],
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? colors.neutral[100] : colors.neutral[900],
    },
    options: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: backgrounds.subtle,
      marginVertical: 4,
    },
    optionActive: {
      backgroundColor: isDark ? primaryPalette[900] : primaryPalette[50],
      borderWidth: 1.5,
      borderColor: isDark ? primaryPalette[400] : primaryPalette[500],
    },
    optionContent: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.neutral[200] : colors.neutral[700],
      marginBottom: 4,
    },
    optionLabelActive: {
      color: isDark ? primaryPalette[300] : primaryPalette[600],
    },
    optionDescription: {
      fontSize: 14,
      color: isDark ? colors.neutral[400] : colors.neutral[500],
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: primaryPalette[500],
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    checkmarkIcon: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.neutral[0],
    },
  });
};
