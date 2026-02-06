/**
 * ThemeSettingsScreen - Theme selection screen
 *
 * Allows users to choose between Light, Dark, and System themes.
 * Also allows users to choose a color scheme (Blue, Green, Monochrome).
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../../design-system/components';
import { StandardLayout } from '../../components/layouts';
import { colors, getPrimaryPaletteForColorScheme, type ColorScheme } from '../../design-system/tokens';
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

interface ColorSchemeOption {
  value: ColorScheme;
  labelKey: string;
  descriptionKey: string;
  icon: keyof typeof Feather.glyphMap;
}

const colorSchemeOptions: ColorSchemeOption[] = [
  {
    value: 'blue',
    labelKey: 'settings.appearance.colorSchemeOptions.blue',
    descriptionKey: 'settings.appearance.colorSchemeDescriptions.blue',
    icon: 'droplet',
  },
  {
    value: 'green',
    labelKey: 'settings.appearance.colorSchemeOptions.green',
    descriptionKey: 'settings.appearance.colorSchemeDescriptions.green',
    icon: 'leaf',
  },
  {
    value: 'monochrome',
    labelKey: 'settings.appearance.colorSchemeOptions.monochrome',
    descriptionKey: 'settings.appearance.colorSchemeDescriptions.monochrome',
    icon: 'square',
  },
];

export const ThemeSettingsScreen = () => {
  const { t } = useTranslation();
  const { themePreference, setTheme, colorSchemePreference, setColorScheme, isDark } = useTheme();

  // Get current color scheme palette for icons
  const currentPalette = getPrimaryPaletteForColorScheme(colorSchemePreference);

  return (
    <StandardLayout useSafeArea={false}>
      <ScrollView className="flex-1">
      {/* Brightness Mode Section */}
      <View className="mt-5 mx-4">
        <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2 px-1">
          {t('settings.appearance.brightnessMode')}
        </Text>
        <Card variant="elevated" className="py-2">
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
                    color={isSelected ? currentPalette[isDark ? 400 : 500] : colors.neutral[isDark ? 400 : 500]}
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
                    color={currentPalette[isDark ? 400 : 500]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </Card>
      </View>

      {/* Color Scheme Section */}
      <View className="mt-6 mx-4 mb-5">
        <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2 px-1">
          {t('settings.appearance.colorScheme')}
        </Text>
        <Card variant="elevated" className="py-2">
          {colorSchemeOptions.map((option, index) => {
            const isSelected = colorSchemePreference === option.value;
            const isLast = index === colorSchemeOptions.length - 1;
            const palette = getPrimaryPaletteForColorScheme(option.value);

            return (
              <TouchableOpacity
                key={option.value}
                className={`flex-row items-center py-4 px-4 ${!isLast ? 'border-b border-border-default' : ''}`}
                onPress={() => setColorScheme(option.value)}
                activeOpacity={0.7}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center mr-4`}
                  style={{
                    backgroundColor: isSelected
                      ? palette[isDark ? 900 : 100]
                      : colors.neutral[isDark ? 800 : 50],
                  }}
                >
                  <Feather
                    name={option.icon}
                    size={20}
                    color={isSelected ? palette[isDark ? 400 : 500] : colors.neutral[isDark ? 400 : 500]}
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
                    color={palette[isDark ? 400 : 500]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </Card>
      </View>
      </ScrollView>
    </StandardLayout>
  );
};
