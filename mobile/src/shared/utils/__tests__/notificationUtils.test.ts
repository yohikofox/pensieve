/**
 * Notification Utilities Tests
 *
 * Tests AC4 requirements:
 * - User receives notification about recovered captures
 * - Proper messages for success/failure/mixed scenarios
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC4: Crash Recovery Notification
 */

import { Alert } from 'react-native';
import {
  showCrashRecoveryNotification,
  showErrorNotification,
  showSuccessNotification,
} from '../notificationUtils';
import type { RecoveredCapture } from '../../../contexts/capture/domain/ICrashRecoveryService';

// Mock React Native Alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('notificationUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('showCrashRecoveryNotification', () => {
    it('should not show notification for empty array', () => {
      showCrashRecoveryNotification([]);

      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should show success notification for single successful recovery', () => {
      const recovered: RecoveredCapture[] = [
        {
          captureId: 'capture-1',
          audioFilePath: '/path/to/audio.m4a',
          state: 'recovered',
        },
      ];

      showCrashRecoveryNotification(recovered);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Enregistrements récupérés',
        'Votre enregistrement interrompu a été récupéré avec succès.',
        [{ text: 'OK', style: 'default' }]
      );
    });

    it('should show success notification for multiple successful recoveries', () => {
      const recovered: RecoveredCapture[] = [
        {
          captureId: 'capture-1',
          audioFilePath: '/path/to/audio1.m4a',
          state: 'recovered',
        },
        {
          captureId: 'capture-2',
          audioFilePath: '/path/to/audio2.m4a',
          state: 'recovered',
        },
      ];

      showCrashRecoveryNotification(recovered);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Enregistrements récupérés',
        '2 enregistrements interrompus ont été récupérés avec succès.',
        [{ text: 'OK', style: 'default' }]
      );
    });

    it('should show failure notification for single failed recovery', () => {
      const recovered: RecoveredCapture[] = [
        {
          captureId: 'capture-1',
          audioFilePath: '/path/to/audio.m4a',
          state: 'failed',
          error: 'Audio file not found',
        },
      ];

      showCrashRecoveryNotification(recovered);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Récupération échouée',
        "Impossible de récupérer l'enregistrement interrompu (fichier audio introuvable).",
        [{ text: 'OK', style: 'default' }]
      );
    });

    it('should show failure notification for multiple failed recoveries', () => {
      const recovered: RecoveredCapture[] = [
        {
          captureId: 'capture-1',
          audioFilePath: '/path/to/audio1.m4a',
          state: 'failed',
          error: 'Audio file not found',
        },
        {
          captureId: 'capture-2',
          audioFilePath: '/path/to/audio2.m4a',
          state: 'failed',
          error: 'Audio file not found',
        },
      ];

      showCrashRecoveryNotification(recovered);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Récupération échouée',
        'Impossible de récupérer 2 enregistrements interrompus (fichiers audio introuvables).',
        [{ text: 'OK', style: 'default' }]
      );
    });

    it('should show partial notification for mixed results', () => {
      const recovered: RecoveredCapture[] = [
        {
          captureId: 'capture-1',
          audioFilePath: '/path/to/audio1.m4a',
          state: 'recovered',
        },
        {
          captureId: 'capture-2',
          audioFilePath: '/path/to/audio2.m4a',
          state: 'recovered',
        },
        {
          captureId: 'capture-3',
          audioFilePath: '/path/to/audio3.m4a',
          state: 'failed',
          error: 'Audio file not found',
        },
      ];

      showCrashRecoveryNotification(recovered);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Récupération partielle',
        '2 enregistrement(s) récupéré(s), 1 échoué(s).',
        [{ text: 'OK', style: 'default' }]
      );
    });
  });

  describe('showErrorNotification', () => {
    it('should show error notification with correct style', () => {
      showErrorNotification('Erreur', 'Permission microphone refusée');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Erreur',
        'Permission microphone refusée',
        [{ text: 'OK', style: 'cancel' }]
      );
    });
  });

  describe('showSuccessNotification', () => {
    it('should show success notification with correct style', () => {
      showSuccessNotification('Succès', 'Enregistrement sauvegardé');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Succès',
        'Enregistrement sauvegardé',
        [{ text: 'OK', style: 'default' }]
      );
    });
  });
});
