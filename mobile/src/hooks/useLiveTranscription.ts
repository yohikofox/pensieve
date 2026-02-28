/**
 * useLiveTranscription Hook
 *
 * Manages live speech-to-text transcription via NativeTranscriptionEngine.
 * Handles volume events, partial/final text accumulation, save and cancel flows.
 *
 * Story 8.6 — Transcription Live avec Waveform
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { container } from "tsyringe";
import { useTranslation } from "react-i18next";
import { useToast } from "../design-system/components";
import { TranscriptionEngineService } from "../contexts/Normalization/services/TranscriptionEngineService";
import { NativeTranscriptionEngine } from "../contexts/Normalization/services/NativeTranscriptionEngine";
import { TextCaptureService } from "../contexts/capture/services/TextCaptureService";
import type { TranscriptionEngineConfig } from "../contexts/Normalization/services/ITranscriptionEngine";

export interface LiveTranscriptionState {
  isListening: boolean;
  isSaving: boolean;
  confirmedText: string;
  partialText: string;
  volumeLevel: number; // -2 à 10
}

export interface UseLiveTranscriptionOptions {
  onClose: () => void;
}

export interface UseLiveTranscriptionReturn {
  state: LiveTranscriptionState;
  startListening: () => Promise<void>;
  stopAndSave: () => Promise<void>;
  cancel: () => Promise<void>;
}

const INITIAL_STATE: LiveTranscriptionState = {
  isListening: false,
  isSaving: false,
  confirmedText: "",
  partialText: "",
  volumeLevel: -2,
};

export function useLiveTranscription(
  options: UseLiveTranscriptionOptions,
): UseLiveTranscriptionReturn {
  const { t, i18n } = useTranslation(); // M3: i18n for dynamic language
  const toast = useToast();
  const [state, setState] = useState<LiveTranscriptionState>(INITIAL_STATE);
  const isListeningRef = useRef(false);

  // M2 fix: stable refs to prevent stale closures and memoization loss
  const onCloseRef = useRef(options.onClose);
  useEffect(() => {
    onCloseRef.current = options.onClose;
  }, [options.onClose]);

  const partialTextRef = useRef("");
  useEffect(() => {
    partialTextRef.current = state.partialText;
  }, [state.partialText]);

  // Lazy DI resolution — never at module level (ADR-021)
  const engineService = useMemo(
    () => container.resolve(TranscriptionEngineService),
    [],
  );
  const nativeEngine = useMemo(
    () => container.resolve(NativeTranscriptionEngine),
    [],
  );
  const textCaptureService = useMemo(
    () => container.resolve(TextCaptureService),
    [],
  );

  // Cleanup on unmount — cancel if still listening
  useEffect(() => {
    return () => {
      if (isListeningRef.current) {
        nativeEngine.cancel().catch(() => {});
      }
    };
  }, [nativeEngine]);

  const startListening = useCallback(async () => {
    try {
      const isNative = await engineService.isNativeEngineSelected();

      if (!isNative) {
        toast.info(t("liveTranscription.nativeRequired"));
        return;
      }

      const config: TranscriptionEngineConfig = {
        language: i18n?.language || "fr-FR", // M3 fix: use active locale
        enableVolumeEvents: true,
      };

      setState((s) => ({ ...s, isListening: true, confirmedText: "", partialText: "", volumeLevel: -2 }));
      isListeningRef.current = true;

      await nativeEngine.startRealTime(
        config,
        // onPartialResult
        (result) => {
          setState((s) => ({ ...s, partialText: result.text }));
        },
        // onFinalResult
        (result) => {
          setState((s) => ({
            ...s,
            confirmedText: s.confirmedText
              ? s.confirmedText + " " + result.text
              : result.text,
            partialText: "",
          }));
        },
        // onVolumeChange
        (value) => {
          setState((s) => ({ ...s, volumeLevel: value }));
        },
        // onEnd — H1 fix: sync listening state when engine ends naturally
        () => {
          isListeningRef.current = false;
          setState((s) => ({ ...s, isListening: false }));
        },
      );
    } catch (error) {
      console.error("[useLiveTranscription] Failed to start:", error);
      toast.error(t("liveTranscription.startError"));
      setState((s) => ({ ...s, isListening: false }));
      isListeningRef.current = false;
    }
  }, [engineService, nativeEngine, t, i18n, toast]); // M2 fix: removed options from deps

  const stopAndSave = useCallback(async () => {
    setState((s) => ({ ...s, isSaving: true }));

    try {
      await nativeEngine.stopRealTime();
      isListeningRef.current = false;

      // Combine accumulated (isFinal) text with any current partial
      const accumulated = nativeEngine.getAccumulatedText();
      const currentPartial = partialTextRef.current; // M2 fix: use ref
      const finalText = accumulated
        ? accumulated + (currentPartial ? " " + currentPartial : "")
        : currentPartial;

      if (!finalText.trim()) {
        toast.info(t("liveTranscription.noText"));
        setState({ ...INITIAL_STATE });
        onCloseRef.current(); // M2 fix: use ref
        return;
      }

      const result = await textCaptureService.createTextCapture(finalText.trim());

      if (result.type !== "success") {
        toast.error(result.error ?? t("liveTranscription.saveError")); // M4 fix
        setState((s) => ({ ...s, isSaving: false }));
        return;
      }

      toast.success(t("liveTranscription.saved"));
      setState({ ...INITIAL_STATE });
      onCloseRef.current(); // M2 fix: use ref
    } catch (error) {
      console.error("[useLiveTranscription] Failed to stop and save:", error);
      toast.error(t("liveTranscription.saveError")); // M4 fix
      setState((s) => ({ ...s, isSaving: false }));
    }
  }, [nativeEngine, textCaptureService, t, toast]); // M2 fix: removed state.partialText and options

  const cancel = useCallback(async () => {
    try {
      await nativeEngine.cancel();
      isListeningRef.current = false;
    } catch (error) {
      console.error("[useLiveTranscription] Failed to cancel:", error);
    } finally {
      setState({ ...INITIAL_STATE });
      onCloseRef.current(); // M2 fix: use ref
    }
  }, [nativeEngine]); // M2 fix: removed options

  return { state, startListening, stopAndSave, cancel };
}
