/**
 * TextCaptureInput Component
 *
 * Reusable text input component for capturing text thoughts
 *
 * Features:
 * - AC1: Auto-focus, auto-open keyboard, multiline support
 * - AC5: Empty text validation
 * - Design System styling with NativeWind
 *
 * Story: 2.2 - Capture Texte Rapide
 */

import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  TextInput,
  Text,
  Keyboard,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows } from '../../design-system/tokens';
import { Button, AlertDialog } from '../../design-system/components';

// Timing constants for animations and focus delays
const FOCUS_DELAY_MS = 100;
const ANIMATION_HOLD_MS = 800;
const ANIMATION_FADE_OUT_MS = 300;
const ANIMATION_FADE_IN_MS = 200;

interface TextCaptureInputProps {
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
}

export interface TextCaptureInputRef {
  focus: () => void;
  blur: () => void;
}

export const TextCaptureInput = forwardRef<TextCaptureInputRef, TextCaptureInputProps>(({
  onSave,
  onCancel,
  placeholder,
}, ref) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // AC6: Animation values for save confirmation
  const saveAnimOpacity = useRef(new Animated.Value(0)).current;
  const saveAnimScale = useRef(new Animated.Value(0.8)).current;

  // Expose focus and blur methods to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      console.log('[TextCaptureInput] focus() called via ref');
      inputRef.current?.focus();
    },
    blur: () => {
      console.log('[TextCaptureInput] blur() called via ref');
      inputRef.current?.blur();
    },
  }));

  // Note: Auto-focus is handled by Modal onShow callback in parent component
  // This ensures focus happens after modal animation completes

  const handleTextChange = (newText: string) => {
    setText(newText);
    // AC5: Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleSave = async () => {
    const trimmedText = text.trim();

    // AC5: Empty text validation
    if (!trimmedText) {
      setError(t('capture.textCapture.emptyError'));
      return;
    }

    // AC6: Haptic feedback on save
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptic feedback may not be available on all devices (silently ignore)
    }

    try {
      // Call onSave and wait for success BEFORE showing animation
      await onSave(trimmedText);

      // AC6: Show save animation ONLY after successful save (Subtask 1.4)
      setIsSaving(true);

      // Animate in: fade + scale up
      Animated.parallel([
        Animated.timing(saveAnimOpacity, {
          toValue: 1,
          duration: ANIMATION_FADE_IN_MS,
          useNativeDriver: true,
        }),
        Animated.spring(saveAnimScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hold for a moment
        setTimeout(() => {
          // Animate out: fade out
          Animated.timing(saveAnimOpacity, {
            toValue: 0,
            duration: ANIMATION_FADE_OUT_MS,
            useNativeDriver: true,
          }).start(() => {
            // Reset animation values
            saveAnimOpacity.setValue(0);
            saveAnimScale.setValue(0.8);
            setIsSaving(false);

            // Clear text for next capture
            setText('');
            setError(null);

            // Return focus to input for successive captures
            setTimeout(() => {
              inputRef.current?.focus();
            }, FOCUS_DELAY_MS);
          });
        }, ANIMATION_HOLD_MS);
      });
    } catch {
      // If save fails, show error and keep the text
      setError(t('capture.textCapture.saveError'));
      setIsSaving(false);
    }
  };

  const handleSubmitEditing = () => {
    // Allow Enter key to submit (but validation still applies)
    handleSave();
  };

  const handleCancel = () => {
    // AC3: Cancel with confirmation if text exists
    const hasUnsavedContent = text.trim().length > 0;

    if (hasUnsavedContent) {
      // Show confirmation dialog
      setShowDiscardDialog(true);
    } else {
      // No unsaved content, just close
      Keyboard.dismiss();
      onCancel();
    }
  };

  const confirmDiscard = () => {
    setShowDiscardDialog(false);
    // Clear text and close
    setText('');
    setError(null);
    Keyboard.dismiss();
    onCancel();
  };

  const isSaveDisabled = !text.trim();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-neutral-100"
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
    >
      <View className="flex-1 p-4" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-1 mb-4">
          <TextInput
            ref={inputRef}
            className={`flex-1 bg-white rounded-lg p-4 text-lg text-neutral-900 border-2 ${
              error ? 'border-error-500' : 'border-neutral-200'
            }`}
            style={shadows.sm}
            value={text}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmitEditing}
            placeholder={placeholder ?? t('capture.textCapture.placeholder')}
            placeholderTextColor={colors.neutral[400]}
            multiline
            autoFocus
            blurOnSubmit={false}
            returnKeyType="done"
            textAlignVertical="top"
          />

          {error && (
            <View className="mt-2 px-1">
              <Text className="text-sm text-error-500 font-medium">{error}</Text>
            </View>
          )}
        </View>

        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onPress={handleCancel}
            testID="cancel-button"
          >
            {t('common.cancel')}
          </Button>

          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onPress={handleSave}
            disabled={isSaveDisabled}
            accessibilityState={{ disabled: isSaveDisabled }}
            testID="save-button"
          >
            {t('common.save')}
          </Button>
        </View>
      </View>

      {/* AC6: Save confirmation animation (Subtask 1.4) */}
      {isSaving && (
        <Animated.View
          className="absolute top-[40%] left-1/2 -ml-20 w-40 bg-primary-500/95 rounded-xl p-5 items-center justify-center"
          style={[
            {
              opacity: saveAnimOpacity,
              transform: [{ scale: saveAnimScale }],
            },
            shadows.lg,
          ]}
        >
          <Text className="text-5xl text-white font-bold mb-2">✓</Text>
          <Text className="text-lg font-semibold text-white">{t('capture.textCapture.saved')}</Text>
        </Animated.View>
      )}

      {/* Discard confirmation dialog */}
      <AlertDialog
        visible={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        title={t('capture.textCapture.discardTitle')}
        message={t('capture.textCapture.discardMessage')}
        icon="trash-2"
        variant="danger"
        confirmAction={{
          label: t('capture.textCapture.discard'),
          onPress: confirmDiscard,
        }}
        cancelAction={{
          label: t('capture.textCapture.continueEditing'),
          onPress: () => setShowDiscardDialog(false),
        }}
      />
    </KeyboardAvoidingView>
  );
});
