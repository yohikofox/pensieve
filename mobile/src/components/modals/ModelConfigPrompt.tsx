/**
 * ModelConfigPrompt - Modal to guide user toward model configuration
 *
 * Story 2.7 - AC2: Show Model Configuration Prompt When No Model Available
 *
 * Shows when user attempts to capture audio but no transcription model is available.
 * Offers two paths:
 * 1. Navigate to Settings to download a model
 * 2. Cancel and proceed with capture (transcription deferred)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../design-system/tokens';
import { useTheme } from '../../hooks/useTheme';

interface ModelConfigPromptProps {
  visible: boolean;
  onGoToSettings: () => void;
  onCancel: () => void;
}

/**
 * Modal prompt to guide user toward model configuration
 *
 * AC2: Shows clear message and two options when no model available
 */
export function ModelConfigPrompt({
  visible,
  onGoToSettings,
  onCancel,
}: ModelConfigPromptProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const themeColors = {
    backdrop: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
    cardBg: isDark ? colors.neutral[800] : '#FFFFFF',
    textPrimary: isDark ? colors.neutral[50] : '#000',
    textSecondary: isDark ? colors.neutral[400] : '#666',
    primaryButton: isDark ? colors.primary[600] : colors.primary[500],
    secondaryButton: isDark ? colors.neutral[700] : '#F2F2F7',
    secondaryButtonText: isDark ? colors.neutral[300] : '#666',
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={[styles.backdrop, { backgroundColor: themeColors.backdrop }]}>
        <View style={[styles.card, { backgroundColor: themeColors.cardBg }]}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.warning[500]}20` }]}>
              <Feather name="download" size={32} color={colors.warning[500]} />
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('modelConfig.prompt.title', 'Transcription requires a model')}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {t(
              'modelConfig.prompt.description',
              'Download a Whisper model to enable audio transcription. Your recordings will be saved and transcribed once a model is available.'
            )}
          </Text>

          {/* Buttons */}
          <View style={styles.buttons}>
            {/* Primary: Go to Settings */}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: themeColors.primaryButton }]}
              onPress={onGoToSettings}
              activeOpacity={0.8}
            >
              <Feather name="settings" size={20} color="#FFF" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>
                {t('modelConfig.prompt.goToSettings', 'Go to Settings')}
              </Text>
            </TouchableOpacity>

            {/* Secondary: Cancel */}
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: themeColors.secondaryButton }]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { color: themeColors.secondaryButtonText }]}>
                {t('modelConfig.prompt.cancel', 'Continue without transcription')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
