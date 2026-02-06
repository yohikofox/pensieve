/**
 * Custom hook for managing capture actions (delete, share, pin, favorite)
 */
import { useCallback } from 'react';
import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { useCaptureRepository } from './useServices';
import type { Capture } from '../contexts/capture/domain/Capture.model';
import { useToast } from '../design-system/components';
import { useCapturesStore } from '../stores/capturesStore';

export function useCaptureActions() {
  const { t } = useTranslation();
  const toast = useToast();
  const repository = useCaptureRepository();
  const loadCaptures = useCapturesStore((state) => state.loadCaptures);
  const updateCapture = useCapturesStore((state) => state.updateCapture);

  const handleDelete = useCallback(
    async (captureId: string) => {
      try {
        await repository.delete(captureId);
        toast.success(t('captures.deleteSuccess', 'Capture supprimée'));
        await loadCaptures();
      } catch (error) {
        console.error('[CaptureActions] Delete failed:', error);
        toast.error(t('errors.deleteFailed', 'Impossible de supprimer'));
      }
    },
    [repository, loadCaptures, toast, t]
  );

  const handleShare = useCallback(
    async (capture: Capture) => {
      try {
        const content = capture.normalizedText || capture.rawContent || '';
        const title = capture.type === 'audio' ? 'Capture audio Pensieve' : 'Capture texte Pensieve';

        await Share.share({
          message: content,
          title: title,
        });
      } catch (error) {
        console.error('[CaptureActions] Share failed:', error);
        toast.error(t('errors.shareFailed', 'Impossible de partager'));
      }
    },
    [toast, t]
  );

  const handleDeleteWav = useCallback(
    async (capture: Capture, onStopPlayback: () => void) => {
      if (!capture.wavPath) return;

      try {
        await FileSystem.deleteAsync(capture.wavPath, { idempotent: true });
        await repository.update(capture.id, { wavPath: null });

        onStopPlayback();
        updateCapture(capture.id);

        console.log('[CaptureActions] Deleted WAV for capture:', capture.id);
      } catch (error) {
        console.error('[CaptureActions] Failed to delete WAV:', error);
        toast.error(t('errors.generic'));
      }
    },
    [repository, updateCapture, toast, t]
  );

  const handlePin = useCallback(
    async (capture: Capture) => {
      // TODO: Implement pin functionality in future story
      toast.info(t('captures.pinTodo', 'Fonctionnalité "Épingler" à venir'));
      console.log('[CaptureActions] Pin capture:', capture.id);
    },
    [toast, t]
  );

  const handleFavorite = useCallback(
    async (capture: Capture) => {
      // TODO: Implement favorite functionality in future story
      toast.info(t('captures.favoriteTodo', 'Fonctionnalité "Favoris" à venir'));
      console.log('[CaptureActions] Favorite capture:', capture.id);
    },
    [toast, t]
  );

  return {
    handleDelete,
    handleShare,
    handleDeleteWav,
    handlePin,
    handleFavorite,
  };
}
