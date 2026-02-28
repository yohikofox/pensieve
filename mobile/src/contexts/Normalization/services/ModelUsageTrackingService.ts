/**
 * ModelUsageTrackingService — Suivi d'utilisation des modèles LLM et Whisper
 *
 * Implémente IModelUsageTrackingService en persisant les timestamps
 * d'utilisation dans AsyncStorage.
 *
 * Pattern AsyncStorage (cohérence avec LLMModelService et TranscriptionModelService,
 * ADR-022 : données non-critiques de type préférence UI).
 *
 * Toutes les méthodes retournent Result<T> (ADR-023).
 * Service stateless → Transient lifecycle (ADR-021).
 *
 * Story: 8.8 - Suggestion de Suppression des Modèles Inutilisés
 * Architecture: ADR-021 (Transient), ADR-022 (AsyncStorage), ADR-023 (Result), ADR-024 (SRP)
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IModelUsageTrackingService, ModelType, UnusedModel } from '../domain/IModelUsageTrackingService';
import {
  type Result,
  RepositoryResultType,
  success,
  unknownError,
} from '../../shared/domain/Result';

// ──────────────────────────────────────────────────────────────────────────────
// Constante centrale (AC3)
// ──────────────────────────────────────────────────────────────────────────────

/** Seuil d'inactivité en jours avant de suggérer la suppression (AC3) */
export const MODEL_INACTIVITY_THRESHOLD_DAYS = 15;

// ──────────────────────────────────────────────────────────────────────────────
// Clés AsyncStorage
// Pattern : @pensieve/model_{action}_{type}_{id}
// ──────────────────────────────────────────────────────────────────────────────

const KEY_LAST_USED = (type: ModelType, id: string): string =>
  `@pensieve/model_last_used_${type}_${id}`;

const KEY_DISMISSED = (type: ModelType, id: string): string =>
  `@pensieve/model_suggestion_dismissed_${type}_${id}`;

// ──────────────────────────────────────────────────────────────────────────────
// Helper interne
// ──────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calcule le nombre de jours entre une date passée et maintenant (arrondi en dessous) */
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

// ──────────────────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────────────────

@injectable()
export class ModelUsageTrackingService implements IModelUsageTrackingService {

  /**
   * Enregistre une utilisation du modèle avec le timestamp actuel (AC1, AC2).
   */
  async trackModelUsed(modelId: string, modelType: ModelType): Promise<Result<void>> {
    try {
      await AsyncStorage.setItem(KEY_LAST_USED(modelType, modelId), new Date(Date.now()).toISOString());
      return success(undefined);
    } catch (error) {
      return unknownError<void>(
        `trackModelUsed failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retourne la date de dernière utilisation, ou null si aucun tracking (AC3).
   */
  async getLastUsedDate(modelId: string, modelType: ModelType): Promise<Result<Date | null>> {
    try {
      const value = await AsyncStorage.getItem(KEY_LAST_USED(modelType, modelId));
      if (value === null) {
        return success(null);
      }
      return success(new Date(value));
    } catch (error) {
      return unknownError<Date | null>(
        `getLastUsedDate failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retourne les modèles téléchargés inactifs depuis thresholdDays jours (AC3).
   *
   * Comportement prudent : si aucune clé lastUsed → modèle NON inclus dans la liste
   * (évite les faux positifs pour modèles téléchargés avant cette fonctionnalité).
   */
  async getUnusedModels(
    downloadedLLMIds: string[],
    downloadedWhisperSizes: string[],
    thresholdDays: number = MODEL_INACTIVITY_THRESHOLD_DAYS,
  ): Promise<Result<UnusedModel[]>> {
    try {
      const unused: UnusedModel[] = [];

      const checkModel = async (modelId: string, modelType: ModelType): Promise<void> => {
        const lastUsedResult = await this.getLastUsedDate(modelId, modelType);
        if (lastUsedResult.type !== RepositoryResultType.SUCCESS) return;

        const lastUsed = lastUsedResult.data;
        if (lastUsed === null) {
          // Pas de clé lastUsed → comportement prudent : ne pas inclure (AC3)
          return;
        }

        const days = daysSince(lastUsed);
        if (days < thresholdDays) return;

        const dismissedResult = await this.hasDismissedSuggestion(modelId, modelType);
        if (
          dismissedResult.type === RepositoryResultType.SUCCESS &&
          dismissedResult.data === true
        ) {
          // Suggestion déjà ignorée et modèle non réutilisé depuis → ne pas ré-afficher (AC7)
          return;
        }

        unused.push({ modelId, modelType, daysSinceLastUse: days });
      };

      await Promise.all([
        ...downloadedLLMIds.map((id) => checkModel(id, 'llm')),
        ...downloadedWhisperSizes.map((size) => checkModel(size, 'whisper')),
      ]);

      return success(unused);
    } catch (error) {
      return unknownError<UnusedModel[]>(
        `getUnusedModels failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Marque la suggestion comme ignorée pour ce modèle (AC7).
   */
  async dismissSuggestion(modelId: string, modelType: ModelType): Promise<Result<void>> {
    try {
      await AsyncStorage.setItem(
        KEY_DISMISSED(modelType, modelId),
        new Date(Date.now()).toISOString(),
      );
      return success(undefined);
    } catch (error) {
      return unknownError<void>(
        `dismissSuggestion failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Vérifie si la suggestion est toujours ignorée (AC7).
   *
   * Logique temporelle :
   * - Pas de clé dismissed → false (jamais ignoré)
   * - Dismissed + jamais réutilisé (lastUsed absent) → true (toujours ignoré)
   * - Dismissed + lastUsed > dismissedDate → false (réutilisé après dismiss → réinitialisation)
   * - Dismissed + lastUsed < dismissedDate → true (toujours ignoré)
   */
  async hasDismissedSuggestion(modelId: string, modelType: ModelType): Promise<Result<boolean>> {
    try {
      const dismissedStr = await AsyncStorage.getItem(KEY_DISMISSED(modelType, modelId));
      if (dismissedStr === null) {
        return success(false);
      }

      const dismissedDate = new Date(dismissedStr);
      const lastUsedStr = await AsyncStorage.getItem(KEY_LAST_USED(modelType, modelId));

      if (lastUsedStr === null) {
        // Dismissé mais jamais réutilisé → toujours ignoré
        return success(true);
      }

      const lastUsedDate = new Date(lastUsedStr);
      // Si réutilisé APRÈS le dismiss → la suggestion peut réapparaître
      const isStillDismissed = dismissedDate > lastUsedDate;
      return success(isStillDismissed);
    } catch (error) {
      return unknownError<boolean>(
        `hasDismissedSuggestion failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Supprime toutes les clés de tracking pour un modèle (AC6 — appelé lors de deleteModel).
   */
  async clearModelTracking(modelId: string, modelType: ModelType): Promise<Result<void>> {
    try {
      await AsyncStorage.multiRemove([
        KEY_LAST_USED(modelType, modelId),
        KEY_DISMISSED(modelType, modelId),
      ]);
      return success(undefined);
    } catch (error) {
      return unknownError<void>(
        `clearModelTracking failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
