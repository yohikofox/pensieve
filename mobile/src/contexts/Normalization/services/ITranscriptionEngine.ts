/**
 * Transcription Engine Interface
 *
 * Abstraction for transcription engines (Whisper, Native Speech Recognition)
 * Allows switching between different transcription backends.
 */

export type TranscriptionEngineType = 'whisper' | 'native';

export interface TranscriptionEngineResult {
  text: string;
  isPartial: boolean; // true for interim results (native real-time)
  confidence?: number; // 0-1, if available
  nativeResults?: unknown; // JSON-serializable native recognition results (engine-agnostic)
}

export interface TranscriptionEngineConfig {
  language: string; // e.g., 'fr-FR', 'en-US'
  vocabulary?: string[]; // Custom vocabulary/hints
}

/**
 * Interface for transcription engines
 *
 * Both Whisper and Native implementations must implement this interface.
 */
export interface ITranscriptionEngine {
  /**
   * Engine type identifier
   */
  readonly type: TranscriptionEngineType;

  /**
   * Human-readable engine name
   */
  readonly displayName: string;

  /**
   * Whether this engine supports real-time transcription
   */
  readonly supportsRealTime: boolean;

  /**
   * Whether this engine works offline
   */
  readonly supportsOffline: boolean;

  /**
   * Initialize the engine (load model, request permissions, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Check if the engine is ready to transcribe
   */
  isReady(): boolean;

  /**
   * Check if this engine is available on the current device
   */
  isAvailable(): Promise<boolean>;

  /**
   * Transcribe an audio file (post-recording)
   *
   * @param audioFilePath - Path to audio file
   * @param config - Transcription configuration
   * @returns Final transcription result
   */
  transcribeFile(
    audioFilePath: string,
    config: TranscriptionEngineConfig
  ): Promise<TranscriptionEngineResult>;

  /**
   * Start real-time transcription (if supported)
   * Results are delivered via onPartialResult and onFinalResult callbacks
   *
   * @param config - Transcription configuration
   * @param onPartialResult - Called with interim results
   * @param onFinalResult - Called with final result
   */
  startRealTime?(
    config: TranscriptionEngineConfig,
    onPartialResult: (result: TranscriptionEngineResult) => void,
    onFinalResult: (result: TranscriptionEngineResult) => void
  ): Promise<void>;

  /**
   * Stop real-time transcription
   */
  stopRealTime?(): Promise<void>;

  /**
   * Release resources (unload model, cleanup)
   */
  release(): Promise<void>;
}
