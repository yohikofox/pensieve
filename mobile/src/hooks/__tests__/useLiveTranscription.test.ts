/**
 * Unit Tests — useLiveTranscription Hook
 *
 * Tests the key behaviors of the live transcription hook:
 * - Cas 1: moteur native → startRealTime appelé, isListening=true
 * - Cas 2: moteur whisper → toast info, startRealTime NON appelé
 * - Cas 3: stop avec texte accumulé → TextCaptureService.createTextCapture appelé
 * - Cas 4: stop sans texte → toast "Aucun texte", pas de createTextCapture
 * - Cas 5: cancel → cancel() appelé, pas de createTextCapture
 * - Cas 6: onFinal reçu → confirmedText mis à jour
 * - Cas 7: onPartial reçu → partialText mis à jour, confirmedText inchangé
 * - Cas 8: onVolumeChange reçu → volumeLevel mis à jour
 *
 * Story 8.6 — Transcription Live avec Waveform
 */

import "reflect-metadata";

// Mock dependencies BEFORE imports
jest.mock("tsyringe");
jest.mock("../../contexts/Normalization/services/TranscriptionEngineService", () => ({
  TranscriptionEngineService: jest.fn(),
}));
jest.mock("../../contexts/Normalization/services/NativeTranscriptionEngine", () => ({
  NativeTranscriptionEngine: jest.fn(),
}));
jest.mock("../../contexts/capture/services/TextCaptureService", () => ({
  TextCaptureService: jest.fn(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "fr-FR" },
  }),
}));
jest.mock("../../design-system/components", () => ({
  useToast: () => ({
    info: mockToastInfo,
    error: mockToastError,
    success: mockToastSuccess,
  }),
}));

import { renderHook, act, waitFor } from "@testing-library/react-native";
import { container } from "tsyringe";
import { useLiveTranscription } from "../useLiveTranscription";
import { RepositoryResultType } from "../../contexts/shared/domain/Result";

// ==========================================
// Mock callbacks
// ==========================================
const mockToastInfo = jest.fn();
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();

// ==========================================
// Mock service implementations
// ==========================================
let capturedOnPartial: ((r: { text: string; isPartial: boolean }) => void) | undefined;
let capturedOnFinal: ((r: { text: string; isPartial: boolean }) => void) | undefined;
let capturedOnVolumeChange: ((v: number) => void) | undefined;

const mockNativeEngine = {
  startRealTime: jest.fn().mockImplementation(
    (_config: unknown, onPartial: unknown, onFinal: unknown, onVolume: unknown, _onEnd: unknown) => {
      capturedOnPartial = onPartial as typeof capturedOnPartial;
      capturedOnFinal = onFinal as typeof capturedOnFinal;
      capturedOnVolumeChange = onVolume as typeof capturedOnVolumeChange;
      return Promise.resolve();
    }
  ),
  stopRealTime: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn().mockResolvedValue(undefined),
  getAccumulatedText: jest.fn().mockReturnValue(""),
};

const mockEngineService = {
  isNativeEngineSelected: jest.fn().mockResolvedValue(true),
};

const mockTextCaptureService = {
  createTextCapture: jest.fn().mockResolvedValue({
    type: RepositoryResultType.SUCCESS,
    data: { id: "capture-id" },
  }),
};

describe("useLiveTranscription", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnPartial = undefined;
    capturedOnFinal = undefined;
    capturedOnVolumeChange = undefined;
    mockNativeEngine.getAccumulatedText.mockReturnValue("");

    // Configure container.resolve to return mocks based on class
    (container.resolve as jest.Mock).mockImplementation((token: unknown) => {
      const { TranscriptionEngineService } = require("../../contexts/Normalization/services/TranscriptionEngineService");
      const { NativeTranscriptionEngine } = require("../../contexts/Normalization/services/NativeTranscriptionEngine");
      const { TextCaptureService } = require("../../contexts/capture/services/TextCaptureService");

      if (token === TranscriptionEngineService) return mockEngineService;
      if (token === NativeTranscriptionEngine) return mockNativeEngine;
      if (token === TextCaptureService) return mockTextCaptureService;
      return {};
    });
  });

  // =====================================================================
  // Cas 1 — moteur native → startRealTime appelé, isListening=true
  // =====================================================================
  it("Cas 1: moteur native → startRealTime appelé, isListening=true", async () => {
    mockEngineService.isNativeEngineSelected.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useLiveTranscription({ onClose: mockOnClose })
    );

    await act(async () => {
      await result.current.startListening();
    });

    expect(mockNativeEngine.startRealTime).toHaveBeenCalledTimes(1);
    expect(result.current.state.isListening).toBe(true);
    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  // =====================================================================
  // Cas 2 — moteur whisper → toast info, startRealTime NON appelé
  // =====================================================================
  it("Cas 2: moteur whisper → toast info, startRealTime NON appelé", async () => {
    mockEngineService.isNativeEngineSelected.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useLiveTranscription({ onClose: mockOnClose })
    );

    await act(async () => {
      await result.current.startListening();
    });

    expect(mockNativeEngine.startRealTime).not.toHaveBeenCalled();
    expect(mockToastInfo).toHaveBeenCalledWith("liveTranscription.nativeRequired");
  });

  // =====================================================================
  // Cas 3 — stop avec texte accumulé → createTextCapture appelé
  // =====================================================================
  it("Cas 3: stop avec texte accumulé → TextCaptureService.createTextCapture appelé", async () => {
    mockEngineService.isNativeEngineSelected.mockResolvedValue(true);
    mockNativeEngine.getAccumulatedText.mockReturnValue("Penser à rappeler Marie demain");

    const { result } = renderHook(() =>
      useLiveTranscription({ onClose: mockOnClose })
    );

    await act(async () => {
      await result.current.startListening();
    });

    await act(async () => {
      await result.current.stopAndSave();
    });

    expect(mockNativeEngine.stopRealTime).toHaveBeenCalledTimes(1);
    expect(mockTextCaptureService.createTextCapture).toHaveBeenCalledWith(
      "Penser à rappeler Marie demain"
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("liveTranscription.saved");
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // =====================================================================
  // Cas 4 — stop sans texte → toast "Aucun texte", pas de createTextCapture
  // =====================================================================
  it("Cas 4: stop sans texte → toast info, createTextCapture NON appelé", async () => {
    mockEngineService.isNativeEngineSelected.mockResolvedValue(true);
    mockNativeEngine.getAccumulatedText.mockReturnValue("");

    const { result } = renderHook(() =>
      useLiveTranscription({ onClose: mockOnClose })
    );

    await act(async () => {
      await result.current.startListening();
    });

    await act(async () => {
      await result.current.stopAndSave();
    });

    expect(mockTextCaptureService.createTextCapture).not.toHaveBeenCalled();
    expect(mockToastInfo).toHaveBeenCalledWith("liveTranscription.noText");
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // =====================================================================
  // Cas 5 — cancel → cancel() appelé, pas de createTextCapture
  // =====================================================================
  it("Cas 5: cancel → engine.cancel() appelé, createTextCapture NON appelé", async () => {
    mockEngineService.isNativeEngineSelected.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useLiveTranscription({ onClose: mockOnClose })
    );

    await act(async () => {
      await result.current.startListening();
    });

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockNativeEngine.cancel).toHaveBeenCalledTimes(1);
    expect(mockTextCaptureService.createTextCapture).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // =====================================================================
  // Cas 6 — onFinal reçu → confirmedText mis à jour
  // =====================================================================
  it("Cas 6: onFinal reçu → confirmedText mis à jour", async () => {
    mockEngineService.isNativeEngineSelected.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useLiveTranscription({ onClose: mockOnClose })
    );

    await act(async () => {
      await result.current.startListening();
    });

    act(() => {
      capturedOnFinal?.({ text: "bonjour monde", isPartial: false });
    });

    await waitFor(() => {
      expect(result.current.state.confirmedText).toBe("bonjour monde");
      expect(result.current.state.partialText).toBe("");
    });
  });

  // =====================================================================
  // Cas 7 — onPartial reçu → partialText mis à jour, confirmedText inchangé
  // =====================================================================
  it("Cas 7: onPartial reçu → partialText mis à jour, confirmedText inchangé", async () => {
    mockEngineService.isNativeEngineSelected.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useLiveTranscription({ onClose: mockOnClose })
    );

    await act(async () => {
      await result.current.startListening();
    });

    act(() => {
      capturedOnPartial?.({ text: "bonsoir", isPartial: true });
    });

    await waitFor(() => {
      expect(result.current.state.partialText).toBe("bonsoir");
      expect(result.current.state.confirmedText).toBe("");
    });
  });

  // =====================================================================
  // Cas 8 — onVolumeChange reçu → volumeLevel mis à jour
  // =====================================================================
  it("Cas 8: onVolumeChange reçu → volumeLevel mis à jour", async () => {
    mockEngineService.isNativeEngineSelected.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useLiveTranscription({ onClose: mockOnClose })
    );

    await act(async () => {
      await result.current.startListening();
    });

    act(() => {
      capturedOnVolumeChange?.(7.5);
    });

    await waitFor(() => {
      expect(result.current.state.volumeLevel).toBe(7.5);
    });
  });
});
