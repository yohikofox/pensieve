/**
 * ThemeSettingsScreen - Theme selection screen
 *
 * Allows users to choose between Light, Dark, and System themes.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../../design-system/components';
import { colors } from '../../design-system/tokens';
import type { ThemePreference } from '../../stores/settingsStore';

interface ThemeOption {
  value: ThemePreference;
  labelKey: string;
  descriptionKey: string;
  icon: keyof typeof Feather.glyphMap;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    labelKey: 'settings.appearance.themeOptions.light',
    descriptionKey: 'settings.appearance.themeDescriptions.light',
    icon: 'sun',
  },
  {
    value: 'dark',
    labelKey: 'settings.appearance.themeOptions.dark',
    descriptionKey: 'settings.appearance.themeDescriptions.dark',
    icon: 'moon',
  },
  {
    value: 'system',
    labelKey: 'settings.appearance.themeOptions.system',
    descriptionKey: 'settings.appearance.themeDescriptions.system',
    icon: 'smartphone',
  },
];

export const ThemeSettingsScreen = () => {
  const { t } = useTranslation();
  const { themePreference, setTheme, isDark, colorScheme } = useTheme();

  // Debug: log current state
  console.log('[ThemeSettingsScreen] colorScheme:', colorScheme, 'themePreference:', themePreference, 'isDark:', isDark);

  return (
    <ScrollView className="flex-1 bg-bg-screen">
      {/* Debug box using theme-aware colors */}
      <View className="mx-4 mt-4 p-3 bg-bg-card rounded-lg border border-border-default">
        <Text className="text-base text-text-primary font-medium">
          Theme Test
        </Text>
        <Text className="text-sm text-text-secondary mt-1">
          Mode: {colorScheme} | Preference: {themePreference}
        </Text>
        <View className="flex-row gap-2 mt-3">
          <View className="flex-1 p-2 bg-status-success-bg rounded border border-status-success-border">
            <Text className="text-xs text-status-success-text text-center">Success</Text>
          </View>
          <View className="flex-1 p-2 bg-status-warning-bg rounded border border-status-warning-border">
            <Text className="text-xs text-status-warning-text text-center">Warning</Text>
          </View>
          <View className="flex-1 p-2 bg-status-error-bg rounded border border-status-error-border">
            <Text className="text-xs text-status-error-text text-center">Error</Text>
          </View>
        </View>
      </View>
      <Card variant="elevated" className="mt-5 mx-4 py-2">
        {themeOptions.map((option, index) => {
          const isSelected = themePreference === option.value;
          const isLast = index === themeOptions.length - 1;

          return (
            <TouchableOpacity
              key={option.value}
              className={`flex-row items-center py-4 px-4 ${!isLast ? 'border-b border-border-default' : ''}`}
              onPress={() => setTheme(option.value)}
              activeOpacity={0.7}
            >
              <View
                className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${
                  isSelected ? 'bg-primary-subtle' : 'bg-bg-subtle'
                }`}
              >
                <Feather
                  name={option.icon}
                  size={20}
                  color={isSelected ? colors.primary[isDark ? 400 : 500] : colors.neutral[isDark ? 400 : 500]}
                />
              </View>

              <View className="flex-1">
                <Text className="text-lg text-text-primary">
                  {t(option.labelKey)}
                </Text>
                <Text className="text-xs text-text-tertiary mt-0.5">
                  {t(option.descriptionKey)}
                </Text>
              </View>

              {isSelected && (
                <Feather
                  name="check"
                  size={24}
                  color={colors.primary[isDark ? 400 : 500]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </Card>
    </ScrollView>
  );
};
