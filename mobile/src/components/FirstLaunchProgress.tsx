/**
 * FirstLaunchProgress
 *
 * Story 24.4 — AC6: UI de Progression Premier Lancement Pixel 9+
 *
 * Modal overlay affiché pendant le téléchargement de Gemma 3 1B MediaPipe.
 * Permet à l'utilisateur de continuer l'installation en arrière-plan.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MODEL_CONFIGS } from '../contexts/Normalization/services/llmModelsConfig';

// Derives size from config — single source of truth (M1 fix)
const GEMMA_SIZE_MB = Math.round(MODEL_CONFIGS['gemma3-1b-mediapipe'].expectedSize / (1024 * 1024));

interface FirstLaunchProgressProps {
  /** Whether to show the overlay */
  visible: boolean;
  /** Download progress 0-1 */
  progress: number;
  /** Called when user taps "Continuer en arrière-plan" */
  onSkip: () => void;
}

export function FirstLaunchProgress({
  visible,
  progress,
  onSkip,
}: FirstLaunchProgressProps) {
  const percent = Math.round(progress * 100);
  const downloadedMb = Math.round(progress * GEMMA_SIZE_MB);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" style={styles.spinner} />

          <Text testID="first-launch-title" style={styles.title}>Optimisation pour votre Pixel 9</Text>

          <Text style={styles.subtitle}>
            Installation de Gemma 3 1B MediaPipe pour une expérience optimale
          </Text>

          <View testID="first-launch-progress-bar" style={styles.progressBarTrack}>
            <View testID="first-launch-progress-fill" style={[styles.progressBarFill, { width: `${percent}%` }]} />
          </View>

          <Text testID="first-launch-progress-text" style={styles.progressText}>
            {percent}% — {downloadedMb} / {GEMMA_SIZE_MB} MB
          </Text>

          <TouchableOpacity
            testID="first-launch-skip-button"
            accessibilityRole="button"
            accessibilityLabel="Continuer en arrière-plan"
            style={styles.skipButton}
            onPress={onSkip}
          >
            <Text style={styles.skipText}>Continuer en arrière-plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#555',
    marginBottom: 20,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1A73E8',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 24,
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1A73E8',
  },
  skipText: {
    fontSize: 14,
    color: '#1A73E8',
    fontWeight: '600',
  },
});
