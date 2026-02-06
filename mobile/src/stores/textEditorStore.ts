import { create } from "zustand";

interface TextEditorState {
  // État par captureId
  edits: Record<string, {
    editedText: string;
    hasChanges: boolean;
    isSaving: boolean;
    copied: boolean;
  }>;

  // Actions
  setEditedText: (captureId: string, text: string) => void;
  setHasChanges: (captureId: string, hasChanges: boolean) => void;
  setIsSaving: (captureId: string, isSaving: boolean) => void;
  setCopied: (captureId: string, copied: boolean) => void;
  resetForCapture: (captureId: string) => void;
}

export const useTextEditorStore = create<TextEditorState>((set) => ({
  edits: {},

  setEditedText: (captureId, text) => set((state) => ({
    edits: {
      ...state.edits,
      [captureId]: {
        ...state.edits[captureId],
        editedText: text
      }
    }
  })),

  setHasChanges: (captureId, hasChanges) => set((state) => ({
    edits: {
      ...state.edits,
      [captureId]: { ...state.edits[captureId], hasChanges }
    }
  })),

  setIsSaving: (captureId, isSaving) => set((state) => ({
    edits: {
      ...state.edits,
      [captureId]: { ...state.edits[captureId], isSaving }
    }
  })),

  setCopied: (captureId, copied) => set((state) => ({
    edits: {
      ...state.edits,
      [captureId]: { ...state.edits[captureId], copied }
    }
  })),

  resetForCapture: (captureId) => set((state) => {
    const { [captureId]: _, ...rest } = state.edits;
    return { edits: rest };
  }),
}));

// Helper hook pour la capture courante
export function useCurrentTextEditor(captureId: string) {
  return useTextEditorStore((state) => state.edits[captureId] || {
    editedText: "",
    hasChanges: false,
    isSaving: false,
    copied: false,
  });
}
