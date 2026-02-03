/**
 * Native Speech Recognition Engine
 *
 * Uses the device's native speech recognition (iOS Speech Framework, Android Speech Recognition).
 * On modern devices (Pixel 6+, newer iPhones), this runs on-device with hardware acceleration.
 *
 * Uses expo-speech-recognition for Expo compatibility.
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import {
  ExpoSpeechRecognitionModule,
  AudioEncodingAndroid,
} from 'expo-speech-recognition';
import { AudioConversionService } from './AudioConversionService';
import {
  ITranscriptionEngine,
  TranscriptionEngineType,
  TranscriptionEngineResult,
  TranscriptionEngineConfig,
} from './ITranscriptionEngine';

@injectable()
export class NativeTranscriptionEngine implements ITranscriptionEngine {
  readonly type: TranscriptionEngineType = 'native';
  readonly displayName = 'Reconnaissance native';
  readonly supportsRealTime = true;
  readonly supportsOffline = true; // On modern devices with on-device models

  private isInitialized = false;
  private isListening = false;
  private partialCallback?: (result: TranscriptionEngineResult) => void;
  private finalCallback?: (result: TranscriptionEngineResult) => void;
  private accumulatedText = '';
  private resultSubscription?: { remove: () => void };
  private errorSubscription?: { remove: () => void };
  private endSubscription?: { remove: () => void };
  private audioConversionService: AudioConversionService;

  constructor(audioConversionService: AudioConversionService) {
    this.audioConversionService = audioConversionService;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Request permissions
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

    if (!result.granted) {
      throw new Error('Speech recognition permission denied');
    }

    this.isInitialized = true;
    console.log('[NativeTranscription] Initialized');
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const status = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      console.log('[NativeTranscription] Permission status:', status);
      // Available if we can ask for permission or already have it
      return status.canAskAgain || status.granted;
    } catch (error) {
      console.error('[NativeTranscription] Availability check failed:', error);
      return false;
    }
  }

  /**
   * Transcribe an audio file using native speech recognition
   *
   * expo-speech-recognition supports file transcription on Android 13+
   * Requires WAV format: 16kHz mono 16-bit PCM
   */
  async transcribeFile(
    audioFilePath: string,
    config: TranscriptionEngineConfig
  ): Promise<TranscriptionEngineResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Convert audio to WAV format (16kHz mono 16-bit PCM)
    console.log('[NativeTranscription] Converting audio to WAV format...');
    const wavPath = await this.audioConversionService.convertToWhisperFormat(audioFilePath);
    console.log('[NativeTranscription] WAV conversion complete:', wavPath);

    try {
      const result = await new Promise<TranscriptionEngineResult>((resolve, reject) => {
        let finalText = '';

        const resultHandler = ExpoSpeechRecognitionModule.addListener('result', (event) => {
          if (event.isFinal) {
            // Take the last result (most complete) instead of first to avoid missing last words
            const lastResult = event.results[event.results.length - 1];
            finalText = lastResult?.transcript || '';
            console.log('[NativeTranscription] Got final result:', finalText.substring(0, 50));
            console.log('[NativeTranscription] Total results segments:', event.results.length);
          }
        });

        const endHandler = ExpoSpeechRecognitionModule.addListener('end', () => {
          resultHandler.remove();
          endHandler.remove();
          errorHandler.remove();

          resolve({
            text: finalText,
            isPartial: false,
          });
        });

        const errorHandler = ExpoSpeechRecognitionModule.addListener('error', (event) => {
          resultHandler.remove();
          endHandler.remove();
          errorHandler.remove();

          // Handle "no speech" as a graceful empty result, not an error
          const errorMessage = event.error || '';
          if (errorMessage.toLowerCase().includes('no speech') ||
              errorMessage.toLowerCase().includes('no match') ||
              errorMessage.toLowerCase().includes('no-speech')) {
            console.log('[NativeTranscription] No speech detected, returning empty result');
            resolve({
              text: '',
              isPartial: false,
            });
          } else {
            reject(new Error(errorMessage || 'Speech recognition failed'));
          }
        });

        // Start recognition with audio source (WAV format)
        // Android requires specific audio config
        ExpoSpeechRecognitionModule.start({
          lang: this.normalizeLocale(config.language),
          interimResults: false,
          audioSource: {
            uri: wavPath,
            audioChannels: 1,
            audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT,
            sampleRate: 16000,
          },
        });
      });

      return result;
    } finally {
      // Cleanup temp WAV file
      await this.audioConversionService.cleanupTempFile(wavPath);
    }
  }

  /**
   * Start real-time speech recognition
   */
  async startRealTime(
    config: TranscriptionEngineConfig,
    onPartialResult: (result: TranscriptionEngineResult) => void,
    onFinalResult: (result: TranscriptionEngineResult) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isListening) {
      console.warn('[NativeTranscription] Already listening, stopping first...');
      await this.stopRealTime();
    }

    this.partialCallback = onPartialResult;
    this.finalCallback = onFinalResult;
    this.accumulatedText = '';

    // Set up event listeners
    this.resultSubscription = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const text = event.results[0]?.transcript || '';

      if (event.isFinal) {
        console.log('[NativeTranscription] Final result:', text);
        this.accumulatedText = text;

        if (this.finalCallback) {
          this.finalCallback({
            text,
            isPartial: false,
            confidence: event.results[0]?.confidence,
          });
        }
      } else {
        console.log('[NativeTranscription] Partial result:', text);
        this.accumulatedText = text;

        if (this.partialCallback) {
          this.partialCallback({
            text,
            isPartial: true,
          });
        }
      }
    });

    this.errorSubscription = ExpoSpeechRecognitionModule.addListener('error', (event) => {
      console.error('[NativeTranscription] Error:', event.error);
      this.isListening = false;
    });

    this.endSubscription = ExpoSpeechRecognitionModule.addListener('end', () => {
      console.log('[NativeTranscription] Recognition ended');
      this.isListening = false;
    });

    const locale = this.normalizeLocale(config.language);
    console.log('[NativeTranscription] Starting with locale:', locale);

    try {
      this.isListening = true;

      await ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        continuous: true,
        contextualStrings: config.vocabulary,
        requiresOnDeviceRecognition: false, // Allow cloud fallback for better accuracy
        addsPunctuation: true,
      });
    } catch (error) {
      this.isListening = false;
      console.error('[NativeTranscription] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop real-time speech recognition
   */
  async stopRealTime(): Promise<void> {
    if (!this.isListening) {
      console.log('[NativeTranscription] Not listening, nothing to stop');
      return;
    }

    try {
      await ExpoSpeechRecognitionModule.stop();
      this.cleanup();
    } catch (error) {
      console.error('[NativeTranscription] Failed to stop:', error);
      throw error;
    }
  }

  /**
   * Cancel speech recognition without getting results
   */
  async cancel(): Promise<void> {
    try {
      await ExpoSpeechRecognitionModule.abort();
      this.cleanup();
      this.accumulatedText = '';
    } catch (error) {
      console.error('[NativeTranscription] Failed to cancel:', error);
    }
  }

  /**
   * Get the accumulated text from partial results
   */
  getAccumulatedText(): string {
    return this.accumulatedText;
  }

  /**
   * Check if currently listening
   */
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  async release(): Promise<void> {
    if (this.isListening) {
      await this.cancel();
    }

    this.cleanup();
    this.isInitialized = false;
    console.log('[NativeTranscription] Released');
  }

  private cleanup(): void {
    this.isListening = false;
    this.partialCallback = undefined;
    this.finalCallback = undefined;

    this.resultSubscription?.remove();
    this.errorSubscription?.remove();
    this.endSubscription?.remove();

    this.resultSubscription = undefined;
    this.errorSubscription = undefined;
    this.endSubscription = undefined;
  }

  /**
   * Normalize language code to full locale (e.g., 'fr' -> 'fr-FR')
   */
  private normalizeLocale(language: string): string {
    if (language.includes('-')) {
      return language;
    }

    const regionMap: Record<string, string> = {
      fr: 'fr-FR',
      en: 'en-US',
      es: 'es-ES',
      de: 'de-DE',
      it: 'it-IT',
      pt: 'pt-BR',
    };

    return regionMap[language] || `${language}-${language.toUpperCase()}`;
  }
}
