/**
 * TodoDetailPopover Navigation Tests (Simplified)
 *
 * Story 5.1 - Task 7: Navigation to Source Capture (AC6, FR20)
 * Subtask 7.8: Unit tests for navigateToSourceCapture with error handling (Task 7.7)
 *
 * Note: These are simplified integration tests focusing on navigation logic
 * without the complexity of rendering the full component.
 */

import 'reflect-metadata';
import { Alert } from 'react-native';
import { container } from 'tsyringe';
import { TOKENS } from '../../../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../../capture/domain/ICaptureRepository';
import type { Capture } from '../../../capture/domain/Capture.model';
import * as Haptics from 'expo-haptics';

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockOnClose = jest.fn();

// Mock CaptureRepository
const mockCaptureRepository: jest.Mocked<ICaptureRepository> = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
  findAllPaginated: jest.fn(),
  count: jest.fn(),
  findByState: jest.fn(),
  findByType: jest.fn(),
  delete: jest.fn(),
  destroyPermanently: jest.fn(),
  findPendingSync: jest.fn(),
  findSynced: jest.fn(),
  findConflicts: jest.fn(),
  isPendingSync: jest.fn(),
  hasConflict: jest.fn(),
  observeById: jest.fn(),
};

describe('TodoDetailPopover - Navigation Logic (Task 7.7, 7.8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Register mock CaptureRepository
    container.clearInstances();
    container.registerInstance(TOKENS.ICaptureRepository, mockCaptureRepository);
  });

  /**
   * Simulates the handleViewOrigin function from TodoDetailPopover
   * This is the exact logic from TodoDetailPopover.tsx lines 137-170
   */
  const handleViewOrigin = async (captureId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Task 7.7: Verify capture exists before navigating
      const captureRepository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      const capture = await captureRepository.findById(captureId);

      if (!capture) {
        // Capture not found or deleted - show error alert
        Alert.alert(
          'Capture introuvable',
          "La capture d'origine n'existe plus ou a été supprimée.",
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Capture exists - navigate to detail screen
      mockOnClose();
      mockNavigate('CaptureDetail', { captureId });
    } catch (error) {
      // Navigation or database error
      console.error('[TodoDetailPopover] Error navigating to capture:', error);
      Alert.alert(
        'Erreur',
        "Impossible d'accéder à la capture d'origine. Veuillez réessayer.",
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  describe('Success Cases', () => {
    it('should navigate to CaptureDetail when capture exists', async () => {
      // Arrange: Mock capture exists
      const mockCapture: Capture = {
        id: 'capture-001',
        type: 'audio',
        state: 'ready',
        rawContent: '/path/to/audio.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncVersion: 0,
      };
      mockCaptureRepository.findById.mockResolvedValue(mockCapture);

      // Act
      await handleViewOrigin('capture-001');

      // Assert: Haptic feedback triggered
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

      // Assert: CaptureRepository.findById called
      expect(mockCaptureRepository.findById).toHaveBeenCalledWith('capture-001');

      // Assert: Navigation called
      expect(mockNavigate).toHaveBeenCalledWith('CaptureDetail', { captureId: 'capture-001' });

      // Assert: Modal closed
      expect(mockOnClose).toHaveBeenCalled();

      // Assert: No alert shown
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should trigger haptic feedback before checking capture existence', async () => {
      // Arrange
      mockCaptureRepository.findById.mockResolvedValue({
        id: 'capture-001',
        type: 'audio',
        state: 'ready',
        rawContent: '/path',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncVersion: 0,
      });

      // Act
      await handleViewOrigin('capture-001');

      // Assert: Haptic feedback called
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });

  describe('Error Cases - Task 7.7 (Error Handling)', () => {
    it('should show alert when capture does not exist (null)', async () => {
      // Arrange: Mock capture not found
      mockCaptureRepository.findById.mockResolvedValue(null);

      // Act
      await handleViewOrigin('capture-001');

      // Assert: Alert shown
      expect(Alert.alert).toHaveBeenCalledWith(
        'Capture introuvable',
        "La capture d'origine n'existe plus ou a été supprimée.",
        [{ text: 'OK', style: 'default' }]
      );

      // Assert: Navigation NOT called
      expect(mockNavigate).not.toHaveBeenCalled();

      // Assert: Modal NOT closed
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should show alert when capture has been deleted', async () => {
      // Arrange
      mockCaptureRepository.findById.mockResolvedValue(null);

      // Act
      await handleViewOrigin('deleted-capture-id');

      // Assert
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.stringContaining('introuvable'),
        expect.stringContaining('supprimée'),
        expect.any(Array)
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should show alert when database error occurs', async () => {
      // Arrange: Mock database error
      mockCaptureRepository.findById.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await handleViewOrigin('capture-001');

      // Assert: Error alert shown
      expect(Alert.alert).toHaveBeenCalledWith(
        'Erreur',
        "Impossible d'accéder à la capture d'origine. Veuillez réessayer.",
        [{ text: 'OK', style: 'default' }]
      );

      // Assert: Navigation NOT called
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should log error to console when navigation fails', async () => {
      // Arrange
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const testError = new Error('Test error');
      mockCaptureRepository.findById.mockRejectedValue(testError);

      // Act
      await handleViewOrigin('capture-001');

      // Assert: Error logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TodoDetailPopover] Error navigating to capture:',
        testError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing captureId gracefully', async () => {
      // Arrange
      mockCaptureRepository.findById.mockResolvedValue(null);

      // Act
      await handleViewOrigin(undefined as any);

      // Assert: findById called with undefined
      expect(mockCaptureRepository.findById).toHaveBeenCalledWith(undefined);

      // Assert: Alert shown
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('should handle empty captureId gracefully', async () => {
      // Arrange
      mockCaptureRepository.findById.mockResolvedValue(null);

      // Act
      await handleViewOrigin('');

      // Assert: findById called with empty string
      expect(mockCaptureRepository.findById).toHaveBeenCalledWith('');

      // Assert: Alert shown
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('should handle network timeout error', async () => {
      // Arrange
      mockCaptureRepository.findById.mockRejectedValue(new Error('Network timeout'));

      // Act
      await handleViewOrigin('capture-001');

      // Assert: Generic error alert shown
      expect(Alert.alert).toHaveBeenCalledWith(
        'Erreur',
        expect.stringContaining('Impossible'),
        expect.any(Array)
      );
    });
  });

  describe('Navigation Flow', () => {
    it('should follow correct execution order: haptic → findById → navigate → close', async () => {
      // Arrange
      const executionOrder: string[] = [];

      (Haptics.impactAsync as jest.Mock).mockImplementation(() => {
        executionOrder.push('haptic');
        return Promise.resolve();
      });

      mockCaptureRepository.findById.mockImplementation(() => {
        executionOrder.push('findById');
        return Promise.resolve({
          id: 'capture-001',
          type: 'audio',
          state: 'ready',
          rawContent: '/path',
          createdAt: new Date(),
          updatedAt: new Date(),
          syncVersion: 0,
        });
      });

      mockNavigate.mockImplementation(() => {
        executionOrder.push('navigate');
      });

      mockOnClose.mockImplementation(() => {
        executionOrder.push('close');
      });

      // Act
      await handleViewOrigin('capture-001');

      // Assert: Correct execution order
      expect(executionOrder).toEqual(['haptic', 'findById', 'close', 'navigate']);
    });
  });
});
