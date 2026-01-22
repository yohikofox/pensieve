/**
 * TextCaptureInput Component
 *
 * Reusable text input component for capturing text thoughts
 *
 * Features:
 * - AC1: Auto-focus, auto-open keyboard, multiline support
 * - AC5: Empty text validation
 * - Liquid Glass Design System styling
 *
 * Story: 2.2 - Capture Texte Rapide
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Alert,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';

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

export const TextCaptureInput: React.FC<TextCaptureInputProps> = ({
  onSave,
  onCancel,
  placeholder = 'Notez votre pensée...',
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // AC6: Animation values for save confirmation
  const saveAnimOpacity = useRef(new Animated.Value(0)).current;
  const saveAnimScale = useRef(new Animated.Value(0.8)).current;

  // AC1: Auto-focus on mount
  useEffect(() => {
    // Small delay to ensure smooth animation
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

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
      setError('Veuillez entrer du texte');
      return;
    }

    // AC6: Haptic feedback on save
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
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
    } catch (error) {
      // If save fails, show error and keep the text
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
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
      Alert.alert(
        'Rejeter la capture?',
        'Le texte non sauvegardé sera perdu.',
        [
          {
            text: 'Continuer l\'édition',
            style: 'cancel',
          },
          {
            text: 'Rejeter',
            style: 'destructive',
            onPress: () => {
              // Clear text and close
              setText('');
              setError(null);
              Keyboard.dismiss();
              onCancel();
            },
          },
        ]
      );
    } else {
      // No unsaved content, just close
      Keyboard.dismiss();
      onCancel();
    }
  };

  const isSaveDisabled = !text.trim();

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[styles.input, error ? styles.inputError : null]}
          value={text}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          multiline
          autoFocus
          blurOnSubmit={false}
          returnKeyType="done"
          textAlignVertical="top"
        />

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.7}
          testID="cancel-button"
        >
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            isSaveDisabled && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaveDisabled}
          accessibilityState={{ disabled: isSaveDisabled }}
          activeOpacity={0.7}
          testID="save-button"
        >
          <Text
            style={[
              styles.saveButtonText,
              isSaveDisabled && styles.saveButtonTextDisabled,
            ]}
          >
            Sauvegarder
          </Text>
        </TouchableOpacity>
      </View>

      {/* AC6: Save confirmation animation (Subtask 1.4) */}
      {isSaving && (
        <Animated.View
          style={[
            styles.saveConfirmation,
            {
              opacity: saveAnimOpacity,
              transform: [{ scale: saveAnimScale }],
            },
          ]}
        >
          <Text style={styles.saveConfirmationIcon}>✓</Text>
          <Text style={styles.saveConfirmationText}>Sauvegardé</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F2F2F7',
  },
  inputContainer: {
    flex: 1,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: '#000000',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    // Liquid Glass Design: Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  saveButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    // Liquid Glass Design: Subtle shadow
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: '#8E8E93',
  },
  // AC6: Save confirmation overlay styles
  saveConfirmation: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: -80,
    width: 160,
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // Liquid Glass Design: Enhanced shadow
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  saveConfirmationIcon: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  saveConfirmationText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
