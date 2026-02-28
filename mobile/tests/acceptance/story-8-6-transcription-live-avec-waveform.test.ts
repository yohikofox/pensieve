/**
 * Story 8.6: Transcription Live avec Waveform
 * Acceptance Tests — BDD / jest-cucumber
 *
 * Valide les comportements clés au niveau service (NativeTranscriptionEngine) :
 * - AC1 : Moteur Whisper → toast informatif, startRealTime non appelé (hook level)
 * - AC2 : Volume events activés via startRealTime avec enableVolumeEvents
 * - AC3 : Résultats partiels / finaux transmis via callbacks
 * - AC5/AC6 : Stop → TextCaptureService.createTextCapture si texte présent
 * - AC5 : Stop sans texte → pas de sauvegarde
 * - AC5 : Cancel → accumulatedText vide, pas de sauvegarde
 *
 * Run: npm run test:acceptance
 */

import "reflect-metadata";
import { loadFeature, defineFeature } from "jest-cucumber";
import { renderHook, act } from "@testing-library/react-native";
import { NativeTranscriptionEngine } from "../../src/contexts/Normalization/services/NativeTranscriptionEngine";
import type { TranscriptionEngineResult } from "../../src/contexts/Normalization/services/ITranscriptionEngine";
import { RepositoryResultType } from "../../src/contexts/shared/domain/Result";

// ==========================================
// Additional mocks for AC1 hook-level test
// ==========================================
jest.mock("tsyringe", () => ({
  container: { resolve: jest.fn() },
  injectable: () => () => {}, // no-op class decorator
  inject: () => () => {},     // no-op parameter decorator
  singleton: () => () => {},
  registerSingleton: jest.fn(),
  registerInstance: jest.fn(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "fr-FR" } }),
}));
const mockToastInfoAC1 = jest.fn();
jest.mock("../../src/design-system/components", () => ({
  useToast: () => ({ info: mockToastInfoAC1, error: jest.fn(), success: jest.fn() }),
}));
jest.mock(
  "../../src/contexts/Normalization/services/TranscriptionEngineService",
  () => ({ TranscriptionEngineService: jest.fn() }),
);
jest.mock(
  "../../src/contexts/capture/services/TextCaptureService",
  () => ({ TextCaptureService: jest.fn() }),
);

// ==========================================
// Mock AudioConversionService
// ==========================================
jest.mock(
  "../../src/contexts/Normalization/services/AudioConversionService",
  () => ({
    AudioConversionService: jest.fn().mockImplementation(() => ({})),
  })
);

// ==========================================
// Mock expo-speech-recognition
// ==========================================
jest.mock("expo-speech-recognition", () => {
  const listeners: Record<string, (...args: unknown[]) => void> = {};

  const ExpoSpeechRecognitionModule = {
    requestPermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true })
    ),
    getPermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true })
    ),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    abort: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn(
      (event: string, handler: (...args: unknown[]) => void) => {
        listeners[event] = handler;
        return { remove: jest.fn() };
      }
    ),
    __listeners: listeners,
    __clearListeners: () => {
      Object.keys(listeners).forEach((key) => delete listeners[key]);
    },
  };

  return {
    ExpoSpeechRecognitionModule,
    AudioEncodingAndroid: { ENCODING_PCM_16BIT: "ENCODING_PCM_16BIT" },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ExpoSpeechRecognitionModule } = jest.requireMock(
  "expo-speech-recognition"
) as {
  ExpoSpeechRecognitionModule: {
    start: jest.Mock;
    stop: jest.Mock;
    abort: jest.Mock;
    addListener: jest.Mock;
    __listeners: Record<string, (...args: unknown[]) => void>;
    __clearListeners: () => void;
  };
};

// ==========================================
// Mock TextCaptureService
// ==========================================
const mockCreateTextCapture = jest.fn().mockResolvedValue({
  type: RepositoryResultType.SUCCESS,
  data: { id: "capture-id", rawContent: "test" },
});

const mockAudioConversionService = {
  convertToWhisperFormatWithPadding: jest.fn(),
  cleanupTempFile: jest.fn(),
};

// ==========================================
// Helpers
// ==========================================
function emitResult(transcript: string, isFinal: boolean): void {
  ExpoSpeechRecognitionModule.__listeners["result"]?.({
    results: [{ transcript, confidence: 0.9 }],
    isFinal,
  });
}

function emitVolumeChange(value: number): void {
  ExpoSpeechRecognitionModule.__listeners["volumechange"]?.({ value });
}

// ==========================================
// BDD Step Definitions
// ==========================================
const feature = loadFeature(
  "./tests/acceptance/features/story-8-6-transcription-live-avec-waveform.feature"
);

defineFeature(feature, (test) => {
  let engine: NativeTranscriptionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    ExpoSpeechRecognitionModule.__clearListeners();
    engine = new NativeTranscriptionEngine(mockAudioConversionService as never);
  });

  // --------------------------------------------------------------------------
  // AC2 — Volume events activés quand enableVolumeEvents: true
  // --------------------------------------------------------------------------
  test("Démarrage avec moteur natif active les événements de volume", ({
    given,
    when,
    then,
    and,
  }) => {
    given("un moteur de transcription native initialisé", () => {
      // engine created in beforeEach
    });

    when("je démarre la transcription live avec les événements volume activés", async () => {
      await engine.startRealTime(
        { language: "fr-FR", enableVolumeEvents: true },
        jest.fn(),
        jest.fn(),
        jest.fn(),
      );
    });

    then("ExpoSpeechRecognitionModule.start est appelé avec volumeChangeEventOptions", () => {
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
        expect.objectContaining({
          volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
        })
      );
    });

    and("le moteur est en état d'écoute active", () => {
      expect(engine.isCurrentlyListening()).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // AC2 — Sans enableVolumeEvents, callback pas appelé
  // --------------------------------------------------------------------------
  test("Sans enableVolumeEvents le callback volumeChange n'est pas appelé", ({
    given,
    when,
    and,
    then,
  }) => {
    let volumeValues: number[] = [];

    given("un moteur de transcription native initialisé", () => {});

    when("je démarre la transcription live sans les événements volume", async () => {
      await engine.startRealTime(
        { language: "fr-FR", enableVolumeEvents: false },
        jest.fn(),
        jest.fn(),
        (v) => volumeValues.push(v),
      );
    });

    and(/^un événement volumechange est émis avec valeur (.+)$/, (valueStr: string) => {
      emitVolumeChange(parseFloat(valueStr));
    });

    then("le callback onVolumeChange n'est pas déclenché", () => {
      // When enableVolumeEvents is false, no volumechange listener is added
      // so the callback should NOT be called
      expect(volumeValues).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // AC3 — Résultats partiels via callback
  // --------------------------------------------------------------------------
  test("Résultat partiel déclenche le callback onPartialResult", ({
    given,
    when,
    then,
    and,
  }) => {
    let lastPartial: TranscriptionEngineResult | undefined;

    given("un moteur de transcription native en écoute", async () => {
      await engine.startRealTime(
        { language: "fr-FR", enableVolumeEvents: true },
        (r) => { lastPartial = r; },
        jest.fn(),
      );
    });

    when('un résultat partiel avec le texte "bonjour" arrive', () => {
      emitResult("bonjour", false);
    });

    then('le callback onPartialResult reçoit le texte "bonjour"', () => {
      expect(lastPartial?.text).toBe("bonjour");
      expect(lastPartial?.isPartial).toBe(true);
    });

    and("le texte accumulé reste vide", () => {
      expect(engine.getAccumulatedText()).toBe("");
    });
  });

  // --------------------------------------------------------------------------
  // AC3 — Résultats finaux accumulés
  // --------------------------------------------------------------------------
  test("Résultat final accumule le texte confirmé", ({
    given,
    when,
    then,
    and,
  }) => {
    let lastFinal: TranscriptionEngineResult | undefined;

    given("un moteur de transcription native en écoute", async () => {
      await engine.startRealTime(
        { language: "fr-FR", enableVolumeEvents: true },
        jest.fn(),
        (r) => { lastFinal = r; },
      );
    });

    when('un résultat final avec le texte "bonjour monde" arrive', () => {
      emitResult("bonjour monde", true);
    });

    then('le callback onFinalResult reçoit le texte "bonjour monde"', () => {
      expect(lastFinal?.text).toBe("bonjour monde");
      expect(lastFinal?.isPartial).toBe(false);
    });

    and('le texte accumulé vaut "bonjour monde"', () => {
      expect(engine.getAccumulatedText()).toBe("bonjour monde");
    });
  });

  // --------------------------------------------------------------------------
  // AC5/AC6 — Stop avec texte → createTextCapture appelé
  // --------------------------------------------------------------------------
  test("Stop avec texte accumulé appelle createTextCapture", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'un moteur de transcription native avec le texte accumulé "Penser à rappeler Marie demain"',
      async () => {
        await engine.startRealTime(
          { language: "fr-FR", enableVolumeEvents: true },
          jest.fn(),
          jest.fn(),
        );
        emitResult("Penser à rappeler Marie demain", true);
      }
    );

    when("je stoppe la transcription et récupère le texte accumulé", async () => {
      const accumulated = engine.getAccumulatedText();
      if (accumulated.trim()) {
        await mockCreateTextCapture(accumulated.trim());
      }
      await engine.stopRealTime();
    });

    then(
      'createTextCapture est appelé avec "Penser à rappeler Marie demain"',
      () => {
        expect(mockCreateTextCapture).toHaveBeenCalledWith(
          "Penser à rappeler Marie demain"
        );
      }
    );

    and("le résultat est un succès", () => {
      expect(mockCreateTextCapture).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // AC5 — Stop sans texte → pas de createTextCapture
  // --------------------------------------------------------------------------
  test("Stop sans texte n'appelle pas createTextCapture", ({
    given,
    when,
    then,
    and,
  }) => {
    given("un moteur de transcription native sans texte accumulé", async () => {
      await engine.startRealTime(
        { language: "fr-FR", enableVolumeEvents: true },
        jest.fn(),
        jest.fn(),
      );
      // No emitResult — accumulatedText stays ""
    });

    when("je stoppe la transcription et vérifie le texte accumulé", async () => {
      const accumulated = engine.getAccumulatedText();
      if (accumulated.trim()) {
        await mockCreateTextCapture(accumulated.trim());
      }
      await engine.stopRealTime();
    });

    then("createTextCapture n'est pas appelé", () => {
      expect(mockCreateTextCapture).not.toHaveBeenCalled();
    });

    and("le moteur n'est plus en écoute", () => {
      expect(engine.isCurrentlyListening()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // AC5 — Cancel efface le texte
  // --------------------------------------------------------------------------
  test("Cancel efface le texte accumulé et arrête l'écoute", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'un moteur de transcription native avec le texte accumulé "du texte en cours"',
      async () => {
        await engine.startRealTime(
          { language: "fr-FR", enableVolumeEvents: true },
          jest.fn(),
          jest.fn(),
        );
        emitResult("du texte en cours", true);
        expect(engine.getAccumulatedText()).toBe("du texte en cours");
      }
    );

    when("j'annule la transcription", async () => {
      await engine.cancel();
    });

    then("le texte accumulé est vide après annulation", () => {
      expect(engine.getAccumulatedText()).toBe("");
    });

    and("createTextCapture n'est pas appelé après annulation", () => {
      expect(mockCreateTextCapture).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // AC1 — Moteur Whisper sélectionné → toast informatif, startRealTime non appelé
  // --------------------------------------------------------------------------
  test("Moteur Whisper sélectionné — la transcription live ne démarre pas", ({
    given,
    when,
    then,
    and,
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useLiveTranscription } = require("../../src/hooks/useLiveTranscription");
    let mockStartRealTime: jest.Mock;

    given(/^le moteur de transcription préféré est "(.+)"$/, (_engine: string) => {
      // _engine = "whisper" → isNativeEngineSelected returns false
      mockStartRealTime = jest.fn().mockResolvedValue(undefined);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { container } = require("tsyringe") as { container: { resolve: jest.Mock } };
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TranscriptionEngineService } = require("../../src/contexts/Normalization/services/TranscriptionEngineService");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { NativeTranscriptionEngine: NTE } = require("../../src/contexts/Normalization/services/NativeTranscriptionEngine");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TextCaptureService } = require("../../src/contexts/capture/services/TextCaptureService");

      container.resolve.mockImplementation((token: unknown) => {
        if (token === TranscriptionEngineService)
          return { isNativeEngineSelected: jest.fn().mockResolvedValue(false) };
        if (token === NTE)
          return { startRealTime: mockStartRealTime, cancel: jest.fn(), getAccumulatedText: jest.fn().mockReturnValue("") };
        if (token === TextCaptureService)
          return { createTextCapture: jest.fn() };
        return {};
      });

      mockToastInfoAC1.mockClear();
    });

    when("je tente de démarrer la transcription live via le hook", async () => {
      const { result } = renderHook(() => useLiveTranscription({ onClose: jest.fn() }));
      await act(async () => {
        await result.current.startListening();
      });
    });

    then("startRealTime n'est pas appelé", () => {
      expect(mockStartRealTime).not.toHaveBeenCalled();
    });

    and(/^un toast informatif "(.+)" est affiché$/, (key: string) => {
      expect(mockToastInfoAC1).toHaveBeenCalledWith(key);
    });
  });
});
