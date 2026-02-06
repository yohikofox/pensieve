/**
 * DeleteCaptureStore
 *
 * Zustand store managing the state of delete capture dialog
 * Allows multiple components to share delete dialog state
 */

import { create } from "zustand";

interface DeleteCaptureState {
  showDeleteDialog: Record<string, boolean>;

  setShowDeleteDialog: (captureId: string, show: boolean) => void;
  reset: (captureId: string) => void;
}

export const useDeleteCaptureStore = create<DeleteCaptureState>((set) => ({
  showDeleteDialog: {},

  setShowDeleteDialog: (captureId, show) =>
    set((state) => ({
      showDeleteDialog: {
        ...state.showDeleteDialog,
        [captureId]: show,
      },
    })),

  reset: (captureId) =>
    set((state) => {
      const newState = { ...state.showDeleteDialog };
      delete newState[captureId];
      return { showDeleteDialog: newState };
    }),
}));

/**
 * Hook to get current capture's delete dialog state
 */
export const useCurrentDeleteCapture = (captureId: string) => {
  const showDeleteDialog = useDeleteCaptureStore(
    (state) => state.showDeleteDialog[captureId] ?? false
  );

  return { showDeleteDialog };
};
