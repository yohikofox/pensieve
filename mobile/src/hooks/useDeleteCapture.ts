/**
 * useDeleteCapture Hook
 *
 * Completely autonomous hook for capture deletion.
 * Reads all data from stores, no parameters needed.
 *
 * Manages capture deletion logic and confirmation dialog
 * Story 5.1 - Refactoring: Extract delete responsibility from CaptureDetailScreen
 * Story 5.4 - Autonomous hook: reads from stores, no prop drilling
 */

import { useNavigation } from "@react-navigation/native";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ICaptureRepository } from "../contexts/capture/domain/ICaptureRepository";
import { useCaptureDetailStore } from "../stores/captureDetailStore";
import { useDeleteCaptureStore, useCurrentDeleteCapture } from "../stores/deleteCaptureStore";
import { useToast } from "../design-system/components";

interface UseDeleteCaptureReturn {
  showDeleteDialog: boolean;
  handleDelete: () => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export function useDeleteCapture(): UseDeleteCaptureReturn {
  // Read everything from stores - autonomous hook
  const capture = useCaptureDetailStore((state) => state.capture);
  const toast = useToast();
  const navigation = useNavigation();

  const captureId = capture?.id || "";

  // Get delete dialog state from store
  const { showDeleteDialog } = useCurrentDeleteCapture(captureId);
  const setShowDeleteDialog = useDeleteCaptureStore((state) => state.setShowDeleteDialog);

  const handleDelete = () => {
    setShowDeleteDialog(captureId, true);
  };

  const confirmDelete = async () => {
    setShowDeleteDialog(captureId, false);
    try {
      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository,
      );
      await repository.delete(captureId);
      navigation.goBack();
    } catch (error) {
      toast.error("Impossible de supprimer la capture");
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(captureId, false);
  };

  return {
    showDeleteDialog,
    handleDelete,
    confirmDelete,
    cancelDelete,
  };
}
