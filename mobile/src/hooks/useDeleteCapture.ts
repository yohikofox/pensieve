/**
 * useDeleteCapture Hook
 *
 * Manages capture deletion logic and confirmation dialog
 * Story 5.1 - Refactoring: Extract delete responsibility from CaptureDetailScreen
 */

import { useState } from "react";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ICaptureRepository } from "../contexts/capture/domain/ICaptureRepository";
import type { ToastService } from "../contexts/common/ui/toast/ToastService";

interface UseDeleteCaptureParams {
  captureId: string;
  toast: ToastService;
  onDeleted: () => void;
}

interface UseDeleteCaptureReturn {
  showDeleteDialog: boolean;
  handleDelete: () => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export function useDeleteCapture({
  captureId,
  toast,
  onDeleted,
}: UseDeleteCaptureParams): UseDeleteCaptureReturn {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setShowDeleteDialog(false);
    try {
      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository,
      );
      await repository.delete(captureId);
      onDeleted();
    } catch (error) {
      toast.error("Impossible de supprimer la capture");
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
  };

  return {
    showDeleteDialog,
    handleDelete,
    confirmDelete,
    cancelDelete,
  };
}
