/**
 * Interface de vérification des mises à jour des modèles LLM et Whisper
 *
 * Vérifie si une mise à jour est disponible en comparant les ETags HTTP.
 * Persiste les informations de date et d'ETag dans AsyncStorage.
 *
 * Story: 8.9 - Vérification Automatique des Mises à Jour des Modèles
 * Architecture: ADR-021 (Transient), ADR-022 (AsyncStorage), ADR-023 (Result), ADR-024 (SRP)
 */

import type { ModelType } from './IModelUsageTrackingService';
import type { Result } from '../../shared/domain/Result';

export type { ModelType };

/**
 * Statut de mise à jour pour un modèle téléchargé.
 * - 'up-to-date'       : ETag identique → aucune mise à jour disponible
 * - 'update-available' : ETag différent → nouvelle version détectée
 * - 'check-failed'     : erreur réseau ou HTTP → statut inconnu
 * - 'unavailable'      : pas d'URL de vérification ou source non supportée
 */
export type ModelUpdateStatus = 'up-to-date' | 'update-available' | 'check-failed' | 'unavailable';

export interface ModelUpdateInfo {
  modelId: string;
  modelType: ModelType;
  status: ModelUpdateStatus | null; // null = jamais vérifié
  downloadDate: Date | null;   // date du téléchargement initial
  updateDate: Date | null;     // date de la dernière mise à jour (ou downloadDate si jamais mis à jour)
  lastCheckDate: Date | null;  // date de la dernière vérification
}

export interface IModelUpdateCheckService {
  /**
   * Enregistre la date de téléchargement et récupère + stocke l'ETag
   * du modèle depuis son URL de téléchargement.
   * Appelé au .done() du téléchargement initial.
   */
  recordDownload(modelId: string, modelType: ModelType, downloadUrl: string): Promise<Result<void>>;

  /**
   * Vérifie si un check est nécessaire pour ce modèle.
   * Retourne false si une vérification a déjà été effectuée aujourd'hui (même jour calendaire UTC).
   */
  isCheckNeeded(modelId: string, modelType: ModelType): Promise<Result<boolean>>;

  /**
   * Effectue la vérification via HTTP HEAD sur downloadUrl.
   * - Compare le 'ETag' ou 'Last-Modified' reçu avec la valeur stockée
   * - Met à jour la date de dernière vérification (lastCheckDate)
   * - Stocke le nouvel ETag si aucun n'était stocké (premier check après migration)
   * @param ignoreThrottle true = forcer la vérification même si déjà faite aujourd'hui
   */
  checkForUpdate(
    modelId: string,
    downloadUrl: string,
    modelType: ModelType,
    ignoreThrottle?: boolean,
  ): Promise<Result<ModelUpdateStatus>>;

  /**
   * Enregistre l'application d'une mise à jour :
   * - Met à jour la date updateDate
   * - Met à jour l'ETag stocké (via HEAD sur downloadUrl)
   * Appelé au .done() du re-téléchargement après "Update".
   */
  recordUpdate(modelId: string, modelType: ModelType, downloadUrl: string): Promise<Result<void>>;

  /**
   * Retourne les informations d'affichage pour la carte du modèle.
   */
  getUpdateInfo(modelId: string, modelType: ModelType): Promise<Result<ModelUpdateInfo>>;

  /**
   * Supprime toutes les clés AsyncStorage liées au tracking de mise à jour.
   * Appelé lors de la suppression physique du modèle.
   */
  clearModelTracking(modelId: string, modelType: ModelType): Promise<Result<void>>;
}
