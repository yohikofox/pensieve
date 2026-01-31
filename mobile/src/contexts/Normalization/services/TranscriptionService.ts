import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { Platform } from "react-native";
import { File } from "expo-file-system";
import { initWhisper, WhisperContext } from "whisper.rn";
import { AudioConversionService } from "./AudioConversionService";
import { TranscriptionModelService } from "./TranscriptionModelService";

export interface PerformanceMetrics {
  audioDuration: number; // Audio file duration in ms
  transcriptionDuration: number; // Time taken to transcribe in ms
  ratio: number; // transcriptionDuration / audioDuration
  meetsNFR2: boolean; // true if ratio <= 2.0
}

export interface TranscriptionResult {
  text: string; // Transcribed text
  wavPath: string | null; // Path to WAV file (only set if debug mode enabled)
  transcriptPrompt: string | null; // Custom vocabulary prompt used during transcription
}

/**
 * Service for audio transcription using Whisper model
 *
 * Responsibilities:
 * - Manage Whisper model lifecycle (load, cache, release)
 * - Transcribe audio files to text
 * - Configure transcription parameters (language, task)
 * - Handle transcription errors
 * - Track transcription duration for performance monitoring
 */
@injectable()
export class TranscriptionService {
  private whisperContext: WhisperContext | null = null;
  private lastTranscriptionDuration: number = 0;
  private lastPerformanceMetrics: PerformanceMetrics | null = null;

  constructor(
    private audioConversionService: AudioConversionService,
    private whisperModelService: TranscriptionModelService,
  ) {}

  /**
   * Transcribe an audio file to text using Whisper
   *
   * @param audioFilePath - Absolute path to audio file
   * @param audioDuration - Duration of audio file in milliseconds (for performance monitoring)
   * @returns TranscriptionResult with text and optional wavPath (if debug mode enabled)
   * @throws Error if audio path invalid, model not loaded, or transcription fails
   */
  async transcribe(
    audioFilePath: string,
    audioDuration?: number,
  ): Promise<TranscriptionResult> {
    if (!audioFilePath || audioFilePath.trim() === "") {
      throw new Error("Invalid audio file path");
    }

    if (!this.whisperContext) {
      throw new Error("Whisper model not loaded. Call loadModel() first.");
    }

    let wavFilePath: string | null = null;

    try {
      const startTime = Date.now();

      // Step 1: Convert audio to Whisper-compatible WAV format (16kHz mono PCM)
      // m4a/AAC recordings are not supported by whisper.rn
      console.log(
        "[TranscriptionService] 🎙️ Starting transcription for:",
        audioFilePath,
      );

      wavFilePath =
        await this.audioConversionService.convertToWhisperFormat(audioFilePath);

      // Step 2: Normalize path for whisper.rn (remove file:// prefix on iOS)
      let normalizedPath = wavFilePath;
      if (Platform.OS === "ios" && wavFilePath.startsWith("file://")) {
        normalizedPath = wavFilePath.replace("file://", "");
      }

      // Step 3: Get custom vocabulary prompt
      const vocabulary = await this.whisperModelService.getPromptString();
      // const prompt = `Transcription d'une note vocale en français. Vocabulaire technique possible.
      //   ${vocabulary ? `Termes spécifiques à inclure: ${vocabulary}` : ""}
      //   `;

      const prompt = `
Transcription fidèle d'une note vocale en français.

Contexte :
- Dictée vocale naturelle
- Contenu professionnel et technique
- Présence possible de termes anglais techniques

Règles :
- Transcrire exactement ce qui est dit
- Ne pas reformuler
- Conserver les noms propres
- Conserver les termes techniques et acronymes
- Ne pas corriger le style

${
  vocabulary
    ? `Glossaire prioritaire (à reconnaître tel quel) :
${vocabulary}
`
    : ""
}
`;

      console.log("[TranscriptionService] 🔄 Transcribing WAV:", {
        original: audioFilePath,
        converted: wavFilePath,
        normalized: normalizedPath,
        hasPrompt: prompt.length > 0,
      });

      // Step 4: Transcribe using Whisper
      const { promise } = this.whisperContext.transcribe(normalizedPath, {
        language: "fr", // French language for Pensieve app
        prompt: prompt || undefined,
      });

      const result = await promise;
      const transcriptionDuration = Date.now() - startTime;

      // Store duration for performance monitoring
      this.lastTranscriptionDuration = transcriptionDuration;

      // Performance monitoring (NFR2: transcription < 2x audio duration)
      if (audioDuration) {
        const ratio = transcriptionDuration / audioDuration;
        const meetsNFR2 = ratio <= 2.0;

        this.lastPerformanceMetrics = {
          audioDuration,
          transcriptionDuration,
          ratio: Math.round(ratio * 100) / 100, // Round to 2 decimals
          meetsNFR2,
        };

        // Warn if NFR2 violated
        if (!meetsNFR2) {
          console.warn(
            "NFR2 violation: Transcription time exceeded 2x audio duration",
            {
              audioDuration,
              transcriptionDuration,
              ratio: Math.round(ratio * 100) / 100,
            },
          );
        }
      }

      // Step 5: Cleanup temporary WAV file (unless debug mode)
      // In debug mode, we keep the file and return its path for playback
      const isDebugMode = this.audioConversionService.isDebugModeEnabled();
      if (!isDebugMode && wavFilePath) {
        await this.audioConversionService.cleanupTempFile(wavFilePath);
      }

      console.log("[TranscriptionService] ✅ Transcription complete", {
        isDebugMode,
        wavPathKept: isDebugMode ? wavFilePath : null,
        promptUsed: prompt || null,
      });

      return {
        text: result.result,
        wavPath: isDebugMode ? wavFilePath : null,
        transcriptPrompt: prompt || null,
      };
    } catch (error) {
      // Cleanup WAV file on error (even in debug mode - failed transcription = broken file)
      if (wavFilePath) {
        try {
          await this.audioConversionService.cleanupTempFile(wavFilePath);
        } catch {
          // Ignore cleanup error
        }
      }
      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Load Whisper model into memory (cached)
   *
   * Model is loaded once and cached for subsequent transcriptions.
   * Call releaseModel() to free memory when done.
   *
   * @param modelPath - Absolute path to Whisper model file (.bin)
   */
  async loadModel(modelPath: string): Promise<void> {
    // Return if model already loaded (cached)
    if (this.whisperContext) {
      console.log("[TranscriptionService] Model already loaded, skipping");
      return;
    }

    console.log(
      "[TranscriptionService] Loading Whisper model from:",
      modelPath,
    );

    // Check if model file exists (Expo 54+ File API)
    const modelFile = new File(modelPath);
    const info = modelFile.info();
    const exists = info.exists;
    const size = exists ? info.size : null;

    console.log("[TranscriptionService] Model file info:", {
      exists,
      size,
      uri: modelPath,
    });

    if (!exists) {
      throw new Error(`Whisper model file not found: ${modelPath}`);
    }

    if (size === 0) {
      throw new Error(`Whisper model file is empty (0 bytes): ${modelPath}`);
    }

    try {
      // Try with GPU first, fallback to CPU if it fails
      console.log(
        "[TranscriptionService] Attempting to load model with GPU...",
      );
      try {
        this.whisperContext = await initWhisper({
          filePath: modelPath,
          useGpu: true,
        });
      } catch (gpuError) {
        console.warn(
          "[TranscriptionService] GPU init failed, trying CPU:",
          gpuError,
        );
        this.whisperContext = await initWhisper({
          filePath: modelPath,
          useGpu: false,
        });
      }
      console.log(
        "[TranscriptionService] ✅ Model loaded successfully, GPU:",
        this.whisperContext.gpu,
      );
    } catch (error) {
      throw new Error(
        `Failed to load Whisper model: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Release Whisper model from memory
   *
   * Call this to free memory when transcription is complete
   * or when app is backgrounding.
   */
  async releaseModel(): Promise<void> {
    if (this.whisperContext) {
      console.log("[TranscriptionService] Releasing Whisper model");
      await this.whisperContext.release();
      this.whisperContext = null;
    }
  }

  /**
   * Check if the model is currently loaded
   */
  isModelLoaded(): boolean {
    return this.whisperContext !== null;
  }

  /**
   * Get duration of last transcription in milliseconds
   *
   * Use this for performance monitoring (NFR2: < 2x audio duration)
   *
   * @returns Duration in milliseconds
   */
  getLastTranscriptionDuration(): number {
    return this.lastTranscriptionDuration;
  }

  /**
   * Get performance metrics for last transcription
   *
   * Returns metrics comparing transcription time to audio duration.
   * Use to monitor NFR2 compliance (< 2x audio duration).
   *
   * @returns Performance metrics or null if no transcription performed yet
   */
  getLastPerformanceMetrics(): PerformanceMetrics | null {
    return this.lastPerformanceMetrics;
  }
}
