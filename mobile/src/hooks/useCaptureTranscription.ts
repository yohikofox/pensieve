/**
 * Custom hook for managing transcription operations
 * Handles transcription queue, retry logic, and model availability
 */
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DI } from '../infrastructure/di/containerHelper';
import type { Capture } from '../contexts/capture/domain/Capture.model';
import { useTranscriptionQueue, useTranscriptionModel, useTranscriptionEngine } from './useServices';
import { NativeTranscriptionEngine } from '../contexts/Normalization/services/NativeTranscriptionEngine';
import { RetryLimitService } from '../contexts/Normalization/services/RetryLimitService';
import { useToast } from '../design-system/components';

export function useCaptureTranscription() {
  const { t } = useTranslation();
  const toast = useToast();

  // Use service hooks
  const queueService = useTranscriptionQueue();
  const modelService = useTranscriptionModel();
  const engineService = useTranscriptionEngine();

  const [hasModelAvailable, setHasModelAvailable] = useState<boolean | null>(null);

  // Check model availability on mount
  useEffect(() => {
    const checkModelAvailability = async () => {
      try {
        const bestModel = await modelService.getBestAvailableModel();
        setHasModelAvailable(bestModel !== null);
      } catch (error) {
        console.error('[Transcription] Failed to check model availability:', error);
        toast.error(t('errors.modelCheckFailed', 'Impossible de vérifier le modèle de transcription'));
        setHasModelAvailable(null);
      }
    };
    checkModelAvailability();
  }, [modelService, t, toast]);

  const checkEngineAvailability = useCallback(async (selectedEngine: string): Promise<boolean> => {
    if (selectedEngine === 'whisper') {
      const bestModel = await modelService.getBestAvailableModel();
      return bestModel !== null;
    }

    if (selectedEngine === 'native') {
      const isNativeFileSupported =
        Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 33;

      if (!isNativeFileSupported) {
        // Fallback to Whisper
        const bestModel = await modelService.getBestAvailableModel();
        return bestModel !== null;
      }

      const nativeEngine = DI.resolve(NativeTranscriptionEngine);
      return await nativeEngine.isAvailable();
    }

    return false;
  }, [modelService]);

  const handleTranscribe = useCallback(
    async (capture: Capture, onRequireModel: () => void) => {
      try {
        const selectedEngine = await engineService.getSelectedEngineType();

        const isAvailable = await checkEngineAvailability(selectedEngine);
        if (!isAvailable) {
          onRequireModel();
          return;
        }

        await queueService.enqueue({
          captureId: capture.id,
          audioPath: capture.rawContent || '',
          audioDuration: capture.duration ?? undefined,
        });

        console.log('[Transcription] Enqueued capture:', capture.id, `[${selectedEngine}]`);
      } catch (error) {
        console.error('[Transcription] Failed to enqueue:', error);
        toast.error(t('capture.alerts.error'));
      }
    },
    [engineService, queueService, checkEngineAvailability, t, toast]
  );

  const handleRetry = useCallback(
    async (capture: Capture) => {
      try {
        const retryService = new RetryLimitService();
        const retryCheck = retryService.canRetry(capture);

        if (!retryCheck.allowed) {
          const message = retryService.getRetryStatusMessage(capture);
          console.error('[Transcription] Retry limit reached:', capture.id);
          toast.error(message);
          return;
        }

        const result = await queueService.retryFailedByCaptureId(capture.id);

        if (result.success) {
          toast.success(t('capture.alerts.retryStarted', 'Nouvelle tentative de transcription...'));
        } else {
          console.error('[Transcription] Retry failed:', result.message);
          toast.error(result.message || t('capture.alerts.retryFailed', 'Échec de la nouvelle tentative'));
        }
      } catch (error) {
        console.error('[Transcription] Retry failed:', error);
        toast.error(t('capture.alerts.retryError', 'Erreur lors de la nouvelle tentative'));
      }
    },
    [queueService, t, toast]
  );

  return {
    hasModelAvailable,
    handleTranscribe,
    handleRetry,
  };
}
