/**
 * Custom hook for managing dialog visibility and state
 */
import { useState, useCallback } from 'react';
import type { Capture } from '../contexts/capture/domain/Capture.model';

export function useDialogState() {
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [showDeleteWavDialog, setShowDeleteWavDialog] = useState(false);
  const [captureToDeleteWav, setCaptureToDeleteWav] = useState<Capture | null>(null);

  const openModelDialog = useCallback(() => {
    setShowModelDialog(true);
  }, []);

  const closeModelDialog = useCallback(() => {
    setShowModelDialog(false);
  }, []);

  const openDeleteWavDialog = useCallback((capture: Capture) => {
    setCaptureToDeleteWav(capture);
    setShowDeleteWavDialog(true);
  }, []);

  const closeDeleteWavDialog = useCallback(() => {
    setShowDeleteWavDialog(false);
    setCaptureToDeleteWav(null);
  }, []);

  return {
    modelDialog: {
      visible: showModelDialog,
      open: openModelDialog,
      close: closeModelDialog,
    },
    deleteWavDialog: {
      visible: showDeleteWavDialog,
      capture: captureToDeleteWav,
      open: openDeleteWavDialog,
      close: closeDeleteWavDialog,
    },
  };
}
