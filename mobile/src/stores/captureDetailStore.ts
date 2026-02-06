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
  isAudio: boolean; // Commonly used check: capture.type === "audio"
  isReady: boolean; // Commonly used check: capture.state === "ready"
  metadata: Record<string, CaptureMetadata>;
  loading: boolean;

  // Listener coordination (for autonomous useCaptureDetailListener)
  captureId: string | null;
  reloadCapture: (() => Promise<void>) | null;

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
  setCaptureId: (id: string | null) => void;
  setReloadCapture: (fn: (() => Promise<void>) | null) => void;
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
  isAudio: false,
  isReady: false,
  metadata: {},
  loading: true,
  captureId: null,
  reloadCapture: null,
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

  setCapture: (capture) => set({
    capture,
    isAudio: capture?.type === "audio",
    isReady: capture?.state === "ready"
  }),
  setMetadata: (metadata) => set({ metadata }),
  setLoading: (loading) => set({ loading }),
  setCaptureId: (id) => set({ captureId: id }),
  setReloadCapture: (fn) => set({ reloadCapture: fn }),
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
