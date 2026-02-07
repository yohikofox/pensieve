/**
 * CaptureDetailStore - Unified Store
 *
 * Single source of truth for the current capture being viewed.
 * Consolidates: capture data, analyses, action items, text editor, UI states.
 *
 * No more captureId indexing - only one capture is active at a time.
 * Reset atomically when navigating to a different capture.
 */

import { create } from "zustand";
import type { Capture } from "../contexts/capture/domain/Capture.model";
import type { CaptureMetadata } from "../contexts/capture/domain/CaptureMetadata.model";
import type {
  CaptureAnalysis,
  AnalysisType,
} from "../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_TYPES } from "../contexts/capture/domain/CaptureAnalysis.model";
import type { ActionItem } from "../contexts/capture/utils/actionItemParser";
import type * as Contacts from "expo-contacts";

// ============================================================================
// Initial States
// ============================================================================

const initialAnalyses: Record<AnalysisType, CaptureAnalysis | null> = {
  [ANALYSIS_TYPES.SUMMARY]: null,
  [ANALYSIS_TYPES.HIGHLIGHTS]: null,
  [ANALYSIS_TYPES.ACTION_ITEMS]: null,
  [ANALYSIS_TYPES.IDEAS]: null,
};

const initialAnalysisLoading: Record<AnalysisType, boolean> = {
  [ANALYSIS_TYPES.SUMMARY]: false,
  [ANALYSIS_TYPES.HIGHLIGHTS]: false,
  [ANALYSIS_TYPES.ACTION_ITEMS]: false,
  [ANALYSIS_TYPES.IDEAS]: false,
};

const initialState = {
  // ──────────────────────────────────────────────────────────────────────────
  // Core Capture Data
  // ──────────────────────────────────────────────────────────────────────────
  captureId: null as string | null,
  capture: null as Capture | null,
  isAudio: false,
  isReady: false,
  metadata: {} as Record<string, CaptureMetadata>,
  loading: true,

  // Listener coordination
  reloadCapture: null as (() => Promise<void>) | null,

  // Model availability (Story 2.7)
  hasModelAvailable: null as boolean | null,
  isNativeEngine: false,

  // ──────────────────────────────────────────────────────────────────────────
  // UI States
  // ──────────────────────────────────────────────────────────────────────────
  showRawTranscript: false,
  showMetadata: false,
  showOriginalContent: false,
  showAnalysis: false,

  // Audio player
  audioPosition: 0,
  audioDuration: 0,

  // ──────────────────────────────────────────────────────────────────────────
  // Text Editor
  // ──────────────────────────────────────────────────────────────────────────
  editedText: "",
  hasTextChanges: false,
  isSavingText: false,
  textCopied: false,

  // ──────────────────────────────────────────────────────────────────────────
  // Analyses
  // ──────────────────────────────────────────────────────────────────────────
  analyses: { ...initialAnalyses },
  analysisLoading: { ...initialAnalysisLoading },

  // ──────────────────────────────────────────────────────────────────────────
  // Action Items
  // ──────────────────────────────────────────────────────────────────────────
  actionItems: null as ActionItem[] | null,

  // Action Items UI
  showDatePicker: false,
  showContactPicker: false,
  showCalendarDialog: false,
  selectedDate: new Date(),
  editingActionIndex: null as number | null,

  // Action Items saving indicators
  savingActionIndex: null as number | null,
  savedActionIndex: null as number | null,
  addingToCalendarIndex: null as number | null,
  addedToCalendarIndex: null as number | null,

  // Contacts for action items
  contacts: [] as Contacts.Contact[],
  contactSearchQuery: "",
  loadingContacts: false,

  // ──────────────────────────────────────────────────────────────────────────
  // Ideas (placeholder for future)
  // ──────────────────────────────────────────────────────────────────────────
  ideas: [] as any[],
  ideasLoading: false,
};

type CaptureDetailState = typeof initialState & {
  // ──────────────────────────────────────────────────────────────────────────
  // Core Actions
  // ──────────────────────────────────────────────────────────────────────────
  setCaptureId: (id: string | null) => void;
  setCapture: (capture: Capture | null) => void;
  setMetadata: (metadata: Record<string, CaptureMetadata>) => void;
  setLoading: (loading: boolean) => void;
  setReloadCapture: (fn: (() => Promise<void>) | null) => void;
  setHasModelAvailable: (available: boolean | null) => void;
  setIsNativeEngine: (isNative: boolean) => void;

  // ──────────────────────────────────────────────────────────────────────────
  // UI Actions
  // ──────────────────────────────────────────────────────────────────────────
  setShowRawTranscript: (show: boolean) => void;
  setShowMetadata: (show: boolean) => void;
  setShowOriginalContent: (show: boolean) => void;
  setShowAnalysis: (show: boolean) => void;
  setAudioPosition: (position: number) => void;
  setAudioDuration: (duration: number) => void;

  // ──────────────────────────────────────────────────────────────────────────
  // Text Editor Actions
  // ──────────────────────────────────────────────────────────────────────────
  setEditedText: (text: string) => void;
  setHasTextChanges: (hasChanges: boolean) => void;
  setIsSavingText: (isSaving: boolean) => void;
  setTextCopied: (copied: boolean) => void;

  // ──────────────────────────────────────────────────────────────────────────
  // Analyses Actions
  // ──────────────────────────────────────────────────────────────────────────
  setAnalysis: (type: AnalysisType, analysis: CaptureAnalysis | null) => void;
  setAnalyses: (analyses: Record<AnalysisType, CaptureAnalysis | null>) => void;
  setAnalysisLoading: (type: AnalysisType, loading: boolean) => void;

  // ──────────────────────────────────────────────────────────────────────────
  // Action Items Actions
  // ──────────────────────────────────────────────────────────────────────────
  setActionItems: (items: ActionItem[] | null) => void;
  setShowDatePicker: (show: boolean) => void;
  setShowContactPicker: (show: boolean) => void;
  setShowCalendarDialog: (show: boolean) => void;
  setSelectedDate: (date: Date) => void;
  setEditingActionIndex: (index: number | null) => void;
  setSavingActionIndex: (index: number | null) => void;
  setSavedActionIndex: (index: number | null) => void;
  setAddingToCalendarIndex: (index: number | null) => void;
  setAddedToCalendarIndex: (index: number | null) => void;
  setContacts: (contacts: Contacts.Contact[]) => void;
  setContactSearchQuery: (query: string) => void;
  setLoadingContacts: (loading: boolean) => void;

  // ──────────────────────────────────────────────────────────────────────────
  // Ideas Actions
  // ──────────────────────────────────────────────────────────────────────────
  setIdeas: (ideas: any[]) => void;
  setIdeasLoading: (loading: boolean) => void;

  // ──────────────────────────────────────────────────────────────────────────
  // Reset
  // ──────────────────────────────────────────────────────────────────────────
  reset: () => void;
};

export const useCaptureDetailStore = create<CaptureDetailState>((set) => ({
  ...initialState,

  // ──────────────────────────────────────────────────────────────────────────
  // Core Actions
  // ──────────────────────────────────────────────────────────────────────────
  setCaptureId: (id) => set({ captureId: id }),

  setCapture: (capture) =>
    set({
      capture,
      isAudio: capture?.type === "audio",
      isReady: capture?.state === "ready",
    }),

  setMetadata: (metadata) => set({ metadata }),
  setLoading: (loading) => set({ loading }),
  setReloadCapture: (fn) => set({ reloadCapture: fn }),
  setHasModelAvailable: (available) => set({ hasModelAvailable: available }),
  setIsNativeEngine: (isNative) => set({ isNativeEngine: isNative }),

  // ──────────────────────────────────────────────────────────────────────────
  // UI Actions
  // ──────────────────────────────────────────────────────────────────────────
  setShowRawTranscript: (show) => set({ showRawTranscript: show }),
  setShowMetadata: (show) => set({ showMetadata: show }),
  setShowOriginalContent: (show) => set({ showOriginalContent: show }),
  setShowAnalysis: (show) => set({ showAnalysis: show }),
  setAudioPosition: (position) => set({ audioPosition: position }),
  setAudioDuration: (duration) => set({ audioDuration: duration }),

  // ──────────────────────────────────────────────────────────────────────────
  // Text Editor Actions
  // ──────────────────────────────────────────────────────────────────────────
  setEditedText: (text) => set({ editedText: text }),
  setHasTextChanges: (hasChanges) => set({ hasTextChanges: hasChanges }),
  setIsSavingText: (isSaving) => set({ isSavingText: isSaving }),
  setTextCopied: (copied) => set({ textCopied: copied }),

  // ──────────────────────────────────────────────────────────────────────────
  // Analyses Actions
  // ──────────────────────────────────────────────────────────────────────────
  setAnalysis: (type, analysis) =>
    set((state) => ({
      analyses: {
        ...state.analyses,
        [type]: analysis,
      },
    })),

  setAnalyses: (analyses) => set({ analyses }),

  setAnalysisLoading: (type, loading) =>
    set((state) => ({
      analysisLoading: {
        ...state.analysisLoading,
        [type]: loading,
      },
    })),

  // ──────────────────────────────────────────────────────────────────────────
  // Action Items Actions
  // ──────────────────────────────────────────────────────────────────────────
  setActionItems: (items) => set({ actionItems: items }),
  setShowDatePicker: (show) => set({ showDatePicker: show }),
  setShowContactPicker: (show) => set({ showContactPicker: show }),
  setShowCalendarDialog: (show) => set({ showCalendarDialog: show }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setEditingActionIndex: (index) => set({ editingActionIndex: index }),
  setSavingActionIndex: (index) => set({ savingActionIndex: index }),
  setSavedActionIndex: (index) => set({ savedActionIndex: index }),
  setAddingToCalendarIndex: (index) => set({ addingToCalendarIndex: index }),
  setAddedToCalendarIndex: (index) => set({ addedToCalendarIndex: index }),
  setContacts: (contacts) => set({ contacts }),
  setContactSearchQuery: (query) => set({ contactSearchQuery: query }),
  setLoadingContacts: (loading) => set({ loadingContacts: loading }),

  // ──────────────────────────────────────────────────────────────────────────
  // Ideas Actions
  // ──────────────────────────────────────────────────────────────────────────
  setIdeas: (ideas) => set({ ideas }),
  setIdeasLoading: (loading) => set({ ideasLoading: loading }),

  // ──────────────────────────────────────────────────────────────────────────
  // Reset - atomic reset when changing captures
  // ──────────────────────────────────────────────────────────────────────────
  reset: () =>
    set({
      ...initialState,
      analyses: { ...initialAnalyses },
      analysisLoading: { ...initialAnalysisLoading },
      selectedDate: new Date(),
    }),
}));
