/**
 * Tests unitaires — NativeTranscriptionEngine
 *
 * Couvre :
 * - AC1 : transcribeFile accumule les segments isFinal (bug fix)
 * - AC2 : startRealTime accumule les segments isFinal (bug fix)
 * - AC3 : audio court (un seul isFinal) — non régressé
 * - AC4 : séparateur espace entre segments
 *
 * Note : jest.mock est hoisted avant les const, donc le mock est créé
 * dans la factory et récupéré via jest.requireMock.
 */

import "reflect-metadata";
import { NativeTranscriptionEngine } from "../NativeTranscriptionEngine";
import { RepositoryResultType } from "../../../shared/domain/Result";

// ==========================================
// Mock expo-speech-recognition
// jest.mock est hoisted — la factory ne peut pas référencer des const
// On définit le mock inside la factory puis on le récupère via requireMock
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
    // Expose pour les tests
    __listeners: listeners,
    __clearListeners: () => {
      Object.keys(listeners).forEach((key) => delete listeners[key]);
    },
  };

  return {
    ExpoSpeechRecognitionModule,
    AudioEncodingAndroid: {
      ENCODING_PCM_16BIT: "ENCODING_PCM_16BIT",
    },
  };
});

// ==========================================
// Récupérer les mocks après le module mock
// ==========================================
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ExpoSpeechRecognitionModule } = jest.requireMock(
  "expo-speech-recognition"
) as {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.Mock;
    getPermissionsAsync: jest.Mock;
    start: jest.Mock;
    stop: jest.Mock;
    abort: jest.Mock;
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

/**
 * Émet une séquence d'événements speech recognition dans les listeners capturés.
 */
function emitResultEvent(
  transcript: string,
  confidence: number,
  isFinal: boolean
): void {
  ExpoSpeechRecognitionModule.__listeners["result"]?.({
    results: [{ transcript, confidence }],
    isFinal,
  });
}

function emitEndEvent(): void {
  ExpoSpeechRecognitionModule.__listeners["end"]?.();
}

// ==========================================
// Tests
// ==========================================

describe("NativeTranscriptionEngine", () => {
  let engine: NativeTranscriptionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    ExpoSpeechRecognitionModule.__clearListeners();

    engine = new NativeTranscriptionEngine(mockAudioConversionService as never);
  });

  // --------------------------------------------------------------------------
  // transcribeFile — AC1 + AC3 + AC4
  // --------------------------------------------------------------------------

  describe("transcribeFile", () => {
    it("AC1 — accumule 3 segments isFinal successifs (texte complet)", async () => {
      // Arrange : déclencher les events juste après que start() est appelé
      ExpoSpeechRecognitionModule.start.mockImplementation(() => {
        setImmediate(() => {
          emitResultEvent("bonjour je suis", 0.9, true);
          emitResultEvent("en train de parler", 0.85, true);
          emitResultEvent("depuis longtemps", 0.8, true);
          emitEndEvent();
        });
      });

      // Act
      const result = await engine.transcribeFile("/mock/audio.m4a", {
        language: "fr",
        vocabulary: [],
      });

      // Assert
      expect(result.text).toBe(
        "bonjour je suis en train de parler depuis longtemps"
      );
      expect(result.isPartial).toBe(false);
    });

    it("AC3 — un seul segment isFinal retourne le même résultat (non régressé)", async () => {
      ExpoSpeechRecognitionModule.start.mockImplementation(() => {
        setImmediate(() => {
          emitResultEvent("texte court", 0.95, true);
          emitEndEvent();
        });
      });

      const result = await engine.transcribeFile("/mock/audio.m4a", {
        language: "fr",
        vocabulary: [],
      });

      expect(result.text).toBe("texte court");
    });

    it("AC4 — les segments sont séparés par un espace simple (pas de doublon)", async () => {
      ExpoSpeechRecognitionModule.start.mockImplementation(() => {
        setImmediate(() => {
          emitResultEvent("premier", 0.9, true);
          emitResultEvent("deuxième", 0.9, true);
          emitEndEvent();
        });
      });

      const result = await engine.transcribeFile("/mock/audio.m4a", {
        language: "fr",
        vocabulary: [],
      });

      expect(result.text).toBe("premier deuxième");
      expect(result.text).not.toContain("  ");
    });

    it("AC1 — 2 segments isFinal : le texte final est la concaténation complète", async () => {
      ExpoSpeechRecognitionModule.start.mockImplementation(() => {
        setImmediate(() => {
          emitResultEvent("segment un", 0.9, true);
          emitResultEvent("segment deux", 0.9, true);
          emitEndEvent();
        });
      });

      const result = await engine.transcribeFile("/mock/audio.m4a", {
        language: "fr",
        vocabulary: [],
      });

      expect(result.text).toBe("segment un segment deux");
    });
  });

  // --------------------------------------------------------------------------
  // startRealTime — AC2 + AC4
  // --------------------------------------------------------------------------

  describe("startRealTime", () => {
    it("AC2 — accumule 2 segments isFinal dans accumulatedText", async () => {
      // Arrange
      const onPartial = jest.fn();
      const onFinal = jest.fn();

      ExpoSpeechRecognitionModule.start.mockResolvedValue(undefined);

      await engine.startRealTime(
        { language: "fr", vocabulary: [] },
        onPartial,
        onFinal
      );

      // Simuler 2 événements isFinal successifs
      emitResultEvent("premier segment", 0.9, true);
      emitResultEvent("deuxième segment", 0.9, true);

      // Assert : accumulatedText contient les deux segments
      expect(engine.getAccumulatedText()).toBe("premier segment deuxième segment");
    });

    it("AC4 — les segments isFinal sont séparés par un espace", async () => {
      const onPartial = jest.fn();
      const onFinal = jest.fn();

      ExpoSpeechRecognitionModule.start.mockResolvedValue(undefined);

      await engine.startRealTime(
        { language: "fr", vocabulary: [] },
        onPartial,
        onFinal
      );

      emitResultEvent("a", 0.9, true);
      emitResultEvent("b", 0.9, true);
      emitResultEvent("c", 0.9, true);

      expect(engine.getAccumulatedText()).toBe("a b c");
      expect(engine.getAccumulatedText()).not.toContain("  ");
    });

    it("AC2 — résultat partiel ne perturbe pas l'accumulation isFinal", async () => {
      const onPartial = jest.fn();
      const onFinal = jest.fn();

      ExpoSpeechRecognitionModule.start.mockResolvedValue(undefined);

      await engine.startRealTime(
        { language: "fr", vocabulary: [] },
        onPartial,
        onFinal
      );

      // Un isFinal, un partiel, puis un autre isFinal
      emitResultEvent("phrase complète", 0.9, true);
      emitResultEvent("résultat partiel en cours", 0.7, false);
      emitResultEvent("deuxième phrase", 0.9, true);

      // L'accumulatedText après le 2ème isFinal doit contenir les 2 segments finaux
      expect(engine.getAccumulatedText()).toBe("phrase complète deuxième phrase");
    });

    it("AC3 — un seul isFinal : accumulatedText identique à l'implémentation actuelle", async () => {
      const onPartial = jest.fn();
      const onFinal = jest.fn();

      ExpoSpeechRecognitionModule.start.mockResolvedValue(undefined);

      await engine.startRealTime(
        { language: "fr", vocabulary: [] },
        onPartial,
        onFinal
      );

      emitResultEvent("texte unique", 0.95, true);

      expect(engine.getAccumulatedText()).toBe("texte unique");
    });
  });
});
