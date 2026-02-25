/**
 * Story 8.20: Fix Transcription Native — Résultat Tronqué pour Audio Long
 * Acceptance Tests — BDD / jest-cucumber
 *
 * Vérifie le comportement utilisateur : la transcription native retourne
 * le texte complet d'un enregistrement contenant plusieurs segments isFinal.
 *
 * Pattern mock : jest.mock hoisted + jest.requireMock (identique aux unit tests
 * NativeTranscriptionEngine — voir Dev Notes story 8.20 pour le raisonnement).
 */

import "reflect-metadata";
import { loadFeature, defineFeature } from "jest-cucumber";
import { NativeTranscriptionEngine } from "../../src/contexts/Normalization/services/NativeTranscriptionEngine";
import { RepositoryResultType } from "../../src/contexts/shared/domain/Result";
import type { TranscriptionEngineResult } from "../../src/contexts/Normalization/services/ITranscriptionEngine";

// ==========================================
// Mock AudioConversionService
// Nécessaire pour couper la chaîne d'imports vers react-native-audio-api
// qui exporte en ESM — incompatible avec ts-jest sans transformIgnorePatterns dédié.
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
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
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
    addListener: jest.Mock;
    __listeners: Record<string, (...args: unknown[]) => void>;
    __clearListeners: () => void;
  };
};

// ==========================================
// Mock AudioConversionService
// ==========================================
const mockAudioConversionService = {
  convertToWhisperFormatWithPadding: jest.fn(() =>
    Promise.resolve({ type: RepositoryResultType.SUCCESS, data: "/tmp/test.wav" })
  ),
  cleanupTempFile: jest.fn(() => Promise.resolve()),
};

// ==========================================
// Helpers
// ==========================================
function emitResult(transcript: string, confidence: number, isFinal: boolean): void {
  ExpoSpeechRecognitionModule.__listeners["result"]?.({
    results: [{ transcript, confidence }],
    isFinal,
  });
}

function emitEnd(): void {
  ExpoSpeechRecognitionModule.__listeners["end"]?.();
}

// ==========================================
// BDD Step Definitions
// ==========================================
const feature = loadFeature(
  "./tests/acceptance/features/story-8-20.feature"
);

defineFeature(feature, (test) => {
  let engine: NativeTranscriptionEngine;
  let transcribeResult: TranscriptionEngineResult | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    ExpoSpeechRecognitionModule.__clearListeners();
    engine = new NativeTranscriptionEngine(mockAudioConversionService as never);
    transcribeResult = undefined;
  });

  // --------------------------------------------------------------------------
  // AC1 — 3 segments isFinal via transcribeFile
  // --------------------------------------------------------------------------
  test("Transcription d'un fichier audio long avec 3 segments isFinal", ({
    given,
    when,
    then,
    and,
  }) => {
    given("un moteur de transcription native prêt", () => {
      ExpoSpeechRecognitionModule.start.mockImplementation(() => {
        setImmediate(() => {
          emitResult("bonjour je suis", 0.9, true);
          emitResult("en train de parler", 0.85, true);
          emitResult("depuis longtemps", 0.8, true);
          emitEnd();
        });
      });
    });

    when(
      "je transcris un fichier audio qui génère 3 segments isFinal successifs",
      async () => {
        transcribeResult = await engine.transcribeFile("/mock/audio.m4a", {
          language: "fr",
          vocabulary: [],
        });
      }
    );

    then("le texte final est la concaténation des 3 segments", () => {
      expect(transcribeResult?.text).toBe(
        "bonjour je suis en train de parler depuis longtemps"
      );
    });

    and("les segments sont séparés par un espace simple", () => {
      expect(transcribeResult?.text).not.toContain("  ");
    });
  });

  // --------------------------------------------------------------------------
  // AC1 — 2 segments isFinal via transcribeFile
  // --------------------------------------------------------------------------
  test("Transcription d'un fichier audio avec 2 segments isFinal", ({
    given,
    when,
    then,
  }) => {
    given("un moteur de transcription native prêt", () => {
      ExpoSpeechRecognitionModule.start.mockImplementation(() => {
        setImmediate(() => {
          emitResult("segment un", 0.9, true);
          emitResult("segment deux", 0.9, true);
          emitEnd();
        });
      });
    });

    when(
      "je transcris un fichier audio qui génère 2 segments isFinal successifs",
      async () => {
        transcribeResult = await engine.transcribeFile("/mock/audio.m4a", {
          language: "fr",
          vocabulary: [],
        });
      }
    );

    then("le texte final est la concaténation des 2 segments", () => {
      expect(transcribeResult?.text).toBe("segment un segment deux");
    });
  });

  // --------------------------------------------------------------------------
  // AC2 — startRealTime accumule les segments isFinal
  // --------------------------------------------------------------------------
  test("Mode temps réel accumule plusieurs segments isFinal", ({
    given,
    when,
    then,
  }) => {
    given("un moteur de transcription native en mode temps réel", async () => {
      ExpoSpeechRecognitionModule.start.mockResolvedValue(undefined);
      await engine.startRealTime(
        { language: "fr", vocabulary: [] },
        jest.fn(),
        jest.fn()
      );
    });

    when("2 segments isFinal sont émis successivement", () => {
      emitResult("première phrase", 0.9, true);
      emitResult("deuxième phrase", 0.85, true);
    });

    then("le texte accumulé contient les 2 segments concaténés", () => {
      expect(engine.getAccumulatedText()).toBe("première phrase deuxième phrase");
    });
  });

  // --------------------------------------------------------------------------
  // AC3 — Non-régression transcribeFile (un seul segment)
  // --------------------------------------------------------------------------
  test("Un seul segment isFinal retourne un résultat identique à avant", ({
    given,
    when,
    then,
  }) => {
    given("un moteur de transcription native prêt", () => {
      ExpoSpeechRecognitionModule.start.mockImplementation(() => {
        setImmediate(() => {
          emitResult("texte court", 0.95, true);
          emitEnd();
        });
      });
    });

    when(
      "je transcris un fichier audio qui génère 1 seul segment isFinal",
      async () => {
        transcribeResult = await engine.transcribeFile("/mock/audio.m4a", {
          language: "fr",
          vocabulary: [],
        });
      }
    );

    then("le texte final est identique au texte du segment", () => {
      expect(transcribeResult?.text).toBe("texte court");
    });
  });

  // --------------------------------------------------------------------------
  // AC3 — Non-régression startRealTime (un seul segment)
  // --------------------------------------------------------------------------
  test("Mode temps réel avec un seul segment isFinal", ({
    given,
    when,
    then,
  }) => {
    given("un moteur de transcription native en mode temps réel", async () => {
      ExpoSpeechRecognitionModule.start.mockResolvedValue(undefined);
      await engine.startRealTime(
        { language: "fr", vocabulary: [] },
        jest.fn(),
        jest.fn()
      );
    });

    when("1 seul segment isFinal est émis", () => {
      emitResult("texte unique", 0.95, true);
    });

    then("le texte accumulé est identique au texte du segment", () => {
      expect(engine.getAccumulatedText()).toBe("texte unique");
    });
  });

  // --------------------------------------------------------------------------
  // AC4 — Séparateur espace simple (transcribeFile)
  // --------------------------------------------------------------------------
  test("Les segments sont séparés par un espace simple sans doublon", ({
    given,
    when,
    then,
    and,
  }) => {
    given("un moteur de transcription native prêt", () => {
      ExpoSpeechRecognitionModule.start.mockImplementation(() => {
        setImmediate(() => {
          emitResult("premier", 0.9, true);
          emitResult("deuxième", 0.9, true);
          emitEnd();
        });
      });
    });

    when(
      "je transcris un fichier audio qui génère 2 segments isFinal",
      async () => {
        transcribeResult = await engine.transcribeFile("/mock/audio.m4a", {
          language: "fr",
          vocabulary: [],
        });
      }
    );

    then("le texte final ne contient pas de doubles espaces", () => {
      expect(transcribeResult?.text).not.toContain("  ");
    });

    and("les segments sont bien séparés par un seul espace", () => {
      expect(transcribeResult?.text).toBe("premier deuxième");
    });
  });

  // --------------------------------------------------------------------------
  // Cohérence — résultats partiels ne corrompent pas l'accumulation isFinal
  // --------------------------------------------------------------------------
  test("Les résultats partiels ne modifient pas l'accumulation isFinal", ({
    given,
    when,
    then,
  }) => {
    given("un moteur de transcription native en mode temps réel", async () => {
      ExpoSpeechRecognitionModule.start.mockResolvedValue(undefined);
      await engine.startRealTime(
        { language: "fr", vocabulary: [] },
        jest.fn(),
        jest.fn()
      );
    });

    when(
      "un segment isFinal puis un résultat partiel puis un segment isFinal sont émis",
      () => {
        emitResult("phrase complète", 0.9, true);
        emitResult("en train de...", 0.5, false);
        emitResult("deuxième phrase", 0.85, true);
      }
    );

    then("le texte accumulé ne contient que les 2 segments isFinal", () => {
      expect(engine.getAccumulatedText()).toBe("phrase complète deuxième phrase");
      expect(engine.getAccumulatedText()).not.toContain("en train de");
    });
  });
});
