/**
 * Transcription Engine Service
 *
 * Manages the selection and switching between transcription engines.
 * Stores user preference and provides the appropriate engine.
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
// ASYNC_STORAGE_OK: UI preference only (transcription engine type selection) — not critical data (ADR-022)
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ITranscriptionEngine,
  TranscriptionEngineType,
} from './ITranscriptionEngine';
import { NativeTranscriptionEngine } from './NativeTranscriptionEngine';

const STORAGE_KEY = '@pensieve/transcription_engine';
// Même valeur que FirstLaunchInitializer — dupliquée intentionnellement pour éviter une dépendance
// circulaire Normalization → identity (ADR-024)
const FIRST_LAUNCH_KEY = '@pensieve/first_launch_completed';
// Marquage one-time de la migration story 8.4 (whisper implicite → explicite pour les utilisateurs existants)
const MIGRATION_KEY = '@pensieve/transcription_default_migrated';

export interface TranscriptionEngineInfo {
  type: TranscriptionEngineType;
  displayName: string;
  description: string;
  supportsRealTime: boolean;
  supportsOffline: boolean;
  isAvailable: boolean;
}

@injectable()
export class TranscriptionEngineService {
  private nativeEngine: NativeTranscriptionEngine;

  constructor(
    @inject(NativeTranscriptionEngine) nativeEngine: NativeTranscriptionEngine
  ) {
    this.nativeEngine = nativeEngine;
  }

  /**
   * Get the currently selected engine type.
   *
   * Priority order:
   * 1. Explicit user preference (stored in AsyncStorage) → return as-is (AC4)
   * 2. No preference, migration not yet run:
   *    - Existing user (FIRST_LAUNCH_KEY = 'true') → migrate to 'whisper' one-time (AC2)
   *    - New user (no FIRST_LAUNCH_KEY) → mark migration done; FirstLaunchInitializer sets 'native' (AC1, AC3)
   * 3. Migration already done, no preference → default to 'native' (AC1)
   */
  async getSelectedEngineType(): Promise<TranscriptionEngineType> {
    try {
      // Cas 1 : Préférence explicite déjà définie → retourner telle quelle
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'native' || stored === 'whisper') {
        return stored;
      }

      // Cas 2 : Aucune préférence — vérifier si migration est nécessaire
      const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
      if (!migrated) {
        // Première fois après story 8.4 — détecter si utilisateur existant
        const firstLaunchDone = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
        if (firstLaunchDone === 'true') {
          // Utilisateur existant sans préférence → préserver 'whisper' implicite
          // Persistence best-effort : retourner 'whisper' même si setItem échoue (AC2)
          await AsyncStorage.setItem(STORAGE_KEY, 'whisper').catch(() => {});
          await AsyncStorage.setItem(MIGRATION_KEY, 'done').catch(() => {});
          return 'whisper';
        }
        // Nouvel utilisateur → marquer migration done (FirstLaunchInitializer gère le reste)
        await AsyncStorage.setItem(MIGRATION_KEY, 'done').catch(() => {});
      }
    } catch (error) {
      console.error('[TranscriptionEngineService] Failed to get preference:', error);
    }
    return 'native'; // Nouveau défaut : natif pour les nouveaux utilisateurs (story 8.4)
  }

  /**
   * Set the transcription engine preference
   */
  async setSelectedEngineType(type: TranscriptionEngineType): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, type);
      console.log('[TranscriptionEngineService] Engine set to:', type);
    } catch (error) {
      console.error('[TranscriptionEngineService] Failed to save preference:', error);
      throw error;
    }
  }

  /**
   * Get list of available engines with their info
   */
  async getAvailableEngines(): Promise<TranscriptionEngineInfo[]> {
    const nativeAvailable = await this.nativeEngine.isAvailable();

    return [
      {
        type: 'whisper',
        displayName: 'Whisper (OpenAI)',
        description: 'Haute précision, fonctionne hors-ligne. Nécessite le téléchargement du modèle.',
        supportsRealTime: false,
        supportsOffline: true,
        isAvailable: true, // Whisper is always available if model is downloaded
      },
      {
        type: 'native',
        displayName: 'Reconnaissance native',
        description: 'Transcription temps réel, accéléré par le hardware. Sur les appareils récents, fonctionne hors-ligne.',
        supportsRealTime: true,
        supportsOffline: true, // On modern devices
        isAvailable: nativeAvailable,
      },
    ];
  }

  /**
   * Get the native transcription engine
   */
  getNativeEngine(): NativeTranscriptionEngine {
    return this.nativeEngine;
  }

  /**
   * Check if native engine is the selected one
   */
  async isNativeEngineSelected(): Promise<boolean> {
    const type = await this.getSelectedEngineType();
    return type === 'native';
  }

  /**
   * Check if native engine is available
   */
  async isNativeEngineAvailable(): Promise<boolean> {
    return this.nativeEngine.isAvailable();
  }
}
