/**
 * SortMenu Component
 * Story 5.3 - AC5, Task 5: Sort options menu
 *
 * Displays 4 sort options: Default | Priority | Created Date | Alphabetical
 * - Current sort option highlighted with checkmark
 * - Haptic feedback on selection
 * - Modal/bottom sheet presentation
 */

import React from 'react';
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area inset
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
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
    backgroundColor: '#F9FAFB',
    marginVertical: 4,
  },
  optionActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  optionLabelActive: {
    color: '#4F46E5',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkmarkIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
