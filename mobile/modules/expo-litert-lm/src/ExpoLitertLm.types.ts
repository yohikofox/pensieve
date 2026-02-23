/**
 * ExpoLitertLm types - Event payloads for LiteRT-LM inference
 */

/** Emitted for each generated token during streaming */
export interface TokenEventPayload {
  /** The request ID this token belongs to */
  requestId: string;
  /** The generated token text */
  token: string;
}

/** Emitted when generation is complete */
export interface GenerationCompletePayload {
  /** The request ID this completion belongs to */
  requestId: string;
  /** Full generated text */
  fullText: string;
  /** Total tokens generated */
  tokenCount: number;
}

/** Emitted when generation encounters an error */
export interface GenerationErrorPayload {
  /** The request ID this error belongs to */
  requestId: string;
  /** Error message */
  error: string;
}
