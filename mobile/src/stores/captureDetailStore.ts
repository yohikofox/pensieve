/**
 * CaptureDetailStore
 *
 * Zustand store managing the state of the current capture being viewed
 * Centralizes capture data, metadata, and UI states for CaptureDetailScreen
 */

import { create } from "zustand";
import type { Capture } from "../contexts/capture/domain/Capture.model";
import type { CaptureMetadata } from "../contexts/capture/domain/CaptureMetadata.model";

interface CaptureDetailState {
  // Core data
  capture: Capture | null;
  metadata: Record<string, CaptureMetadata>;
  loading: boolean;

  // UI states
  showRawTranscript: boolean;
  showMetadata: boolean;
  showOriginalContent: boolean;
  showAnalysis: boolean;

  // Audio player state
  audioPosition: number; // in milliseconds
  audioDuration: number; // in milliseconds

  // Model availability (Story 2.7)
  hasModelAvailable: boolean | null;
  isNativeEngine: boolean;

  // Actions
  setCapture: (capture: Capture | null) => void;
  setMetadata: (metadata: Record<string, CaptureMetadata>) => void;
  setLoading: (loading: boolean) => void;
  setShowRawTranscript: (show: boolean) => void;
  setShowMetadata: (show: boolean) => void;
  setShowOriginalContent: (show: boolean) => void;
  setShowAnalysis: (show: boolean) => void;
  setAudioPosition: (position: number) => void;
  setAudioDuration: (duration: number) => void;
  setHasModelAvailable: (available: boolean | null) => void;
  setIsNativeEngine: (isNative: boolean) => void;

  // Reset state (when leaving detail screen)
  reset: () => void;
}

const initialState = {
  capture: null,
  metadata: {},
  loading: true,
  showRawTranscript: false,
  showMetadata: false,
  showOriginalContent: false,
  showAnalysis: false,
  audioPosition: 0,
  audioDuration: 0,
  hasModelAvailable: null,
  isNativeEngine: false,
};

export const useCaptureDetailStore = create<CaptureDetailState>((set) => ({
  ...initialState,

  setCapture: (capture) => set({ capture }),
  setMetadata: (metadata) => set({ metadata }),
  setLoading: (loading) => set({ loading }),
  setShowRawTranscript: (show) => set({ showRawTranscript: show }),
  setShowMetadata: (show) => set({ showMetadata: show }),
  setShowOriginalContent: (show) => set({ showOriginalContent: show }),
  setShowAnalysis: (show) => set({ showAnalysis: show }),
  setAudioPosition: (position) => set({ audioPosition: position }),
  setAudioDuration: (duration) => set({ audioDuration: duration }),
  setHasModelAvailable: (available) => set({ hasModelAvailable: available }),
  setIsNativeEngine: (isNative) => set({ isNativeEngine: isNative }),

  reset: () => set(initialState),
}));
