/**
 * Interface for model usage tracking service
 *
 * Tracks when LLM and Whisper models are used, detects models inactive
 * for more than MODEL_INACTIVITY_THRESHOLD_DAYS days, and manages
 * user-dismissed suggestions to avoid re-showing alerts.
 *
 * Story: 8.8 - Suggestion de Suppression des Modèles Inutilisés
 * Architecture: ADR-023 (Result Pattern), ADR-024 (SRP)
 */

import type { Result } from '../../shared/domain/Result';

export type ModelType = 'llm' | 'whisper';

export interface UnusedModel {
  modelId: string;
  modelType: ModelType;
  /** Nombre de jours écoulés depuis la dernière utilisation */
  daysSinceLastUse: number;
  /** Taille en octets si connue (pour affichage "Supprimer (2.0 Go)") */
  sizeBytes?: number;
}

export interface IModelUsageTrackingService {
  /**
   * Enregistre une utilisation du modèle avec le timestamp actuel.
   * Réinitialise le badge d'inactivité (le modèle ne peut plus être "inutilisé").
   *
   * @param modelId   - Identifiant unique du modèle (LLM ID ou taille Whisper)
   * @param modelType - Type de modèle : 'llm' | 'whisper'
   */
  trackModelUsed(modelId: string, modelType: ModelType): Promise<Result<void>>;

  /**
   * Retourne la date de dernière utilisation enregistrée pour un modèle.
   *
   * @returns Date si la clé existe, null si aucun tracking (modèle jamais tracké)
   */
  getLastUsedDate(modelId: string, modelType: ModelType): Promise<Result<Date | null>>;

  /**
   * Retourne la liste des modèles téléchargés qui n'ont pas été utilisés
   * depuis au moins thresholdDays jours et dont l'alerte n'a pas été ignorée.
   *
   * Comportement prudent : si aucune clé lastUsed n'existe pour un modèle,
   * il n'est PAS inclus dans la liste (évite les faux positifs pour les modèles
   * téléchargés avant cette fonctionnalité).
   *
   * @param downloadedLLMIds       - IDs des modèles LLM présents sur le disque
   * @param downloadedWhisperSizes - Tailles des modèles Whisper présents sur le disque
   * @param thresholdDays          - Seuil d'inactivité en jours (défaut: 15)
   */
  getUnusedModels(
    downloadedLLMIds: string[],
    downloadedWhisperSizes: string[],
    thresholdDays?: number,
  ): Promise<Result<UnusedModel[]>>;

  /**
   * Marque une suggestion de suppression comme ignorée par l'utilisateur.
   * L'alerte ne réapparaîtra plus sauf si le modèle est réutilisé.
   *
   * @param modelId   - Identifiant unique du modèle
   * @param modelType - Type de modèle : 'llm' | 'whisper'
   */
  dismissSuggestion(modelId: string, modelType: ModelType): Promise<Result<void>>;

  /**
   * Vérifie si l'utilisateur a ignoré la suggestion pour ce modèle,
   * et si le modèle n'a pas été réutilisé depuis le dismiss.
   *
   * Logique temporelle :
   * - Pas de clé dismissed → false
   * - Dismissed + jamais réutilisé → true
   * - Dismissed + réutilisé après le dismiss → false (réinitialisation implicite)
   *
   * @returns true si la suggestion doit rester masquée
   */
  hasDismissedSuggestion(modelId: string, modelType: ModelType): Promise<Result<boolean>>;

  /**
   * Supprime toutes les clés AsyncStorage liées au tracking d'un modèle.
   * Appelé lors de la suppression physique du fichier modèle.
   *
   * @param modelId   - Identifiant unique du modèle
   * @param modelType - Type de modèle : 'llm' | 'whisper'
   */
  clearModelTracking(modelId: string, modelType: ModelType): Promise<Result<void>>;
}
