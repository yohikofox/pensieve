/**
 * ModelUpdateCheckService — Vérification des mises à jour des modèles LLM et Whisper
 *
 * Vérifie les mises à jour via HTTP HEAD (comparaison ETag/Last-Modified).
 * Persiste les informations de date et d'ETag dans AsyncStorage.
 *
 * Pattern AsyncStorage (cohérence avec ModelUsageTrackingService — ADR-022).
 * Toutes les méthodes retournent Result<T> (ADR-023).
 * Service stateless → Transient lifecycle (ADR-021).
 *
 * Story: 8.9 - Vérification Automatique des Mises à Jour des Modèles
 * Architecture: ADR-021 (Transient), ADR-022 (AsyncStorage), ADR-023 (Result), ADR-024 (SRP)
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  IModelUpdateCheckService,
  ModelType,
  ModelUpdateInfo,
  ModelUpdateStatus,
} from '../domain/IModelUpdateCheckService';
import { type Result, success, unknownError } from '../../shared/domain/Result';

// ──────────────────────────────────────────────────────────────────────────────
// Clés AsyncStorage
// Pattern : @pensieve/model_{action}_{type}_{id}
// ──────────────────────────────────────────────────────────────────────────────

const KEY_DOWNLOAD_DATE = (t: ModelType, id: string): string =>
  `@pensieve/model_download_date_${t}_${id}`;

const KEY_UPDATE_DATE = (t: ModelType, id: string): string =>
  `@pensieve/model_update_date_${t}_${id}`;

const KEY_LAST_CHECK = (t: ModelType, id: string): string =>
  `@pensieve/model_last_check_date_${t}_${id}`;

const KEY_STORED_ETAG = (t: ModelType, id: string): string =>
  `@pensieve/model_stored_etag_${t}_${id}`;

const KEY_UPDATE_STATUS = (t: ModelType, id: string): string =>
  `@pensieve/model_update_status_${t}_${id}`;

// ──────────────────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────────────────

@injectable()
export class ModelUpdateCheckService implements IModelUpdateCheckService {

  /**
   * Enregistre la date de téléchargement et tente de récupérer l'ETag initial (best-effort).
   * Appelé au .done() du téléchargement initial (AC4).
   */
  async recordDownload(modelId: string, modelType: ModelType, downloadUrl: string): Promise<Result<void>> {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.multiSet([
        [KEY_DOWNLOAD_DATE(modelType, modelId), now],
        [KEY_UPDATE_DATE(modelType, modelId), now],
      ]);

      // Tenter de récupérer l'ETag initial (best-effort, ne pas bloquer si réseau KO)
      try {
        const response = await fetch(downloadUrl, { method: 'HEAD', redirect: 'follow' });
        const etag =
          response.headers.get('ETag') ??
          response.headers.get('etag') ??
          response.headers.get('Last-Modified');
        if (etag) {
          await AsyncStorage.setItem(KEY_STORED_ETAG(modelType, modelId), etag);
        }
      } catch {
        // Fail silently — pas critique pour le fonctionnement de base
      }

      return success(undefined);
    } catch (error) {
      return unknownError<void>(
        `recordDownload failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Vérifie si un check est nécessaire pour ce modèle.
   * Retourne false si une vérification a déjà été effectuée aujourd'hui (même jour calendaire UTC).
   * Retourne true si jamais vérifié ou si la dernière vérification date d'avant aujourd'hui (AC3).
   */
  async isCheckNeeded(modelId: string, modelType: ModelType): Promise<Result<boolean>> {
    try {
      const lastCheckStr = await AsyncStorage.getItem(KEY_LAST_CHECK(modelType, modelId));
      if (lastCheckStr === null) return success(true); // jamais vérifié

      const lastCheck = new Date(lastCheckStr);
      if (isNaN(lastCheck.getTime())) return success(true); // données corrompues → vérifier

      const now = new Date();
      // Comparer par jour calendaire UTC (pas par delta 24h glissant)
      const sameDay =
        lastCheck.getUTCFullYear() === now.getUTCFullYear() &&
        lastCheck.getUTCMonth() === now.getUTCMonth() &&
        lastCheck.getUTCDate() === now.getUTCDate();

      return success(!sameDay);
    } catch (error) {
      return unknownError<boolean>(
        `isCheckNeeded failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Effectue la vérification via HTTP HEAD sur downloadUrl.
   * Gère le throttle (skip si déjà vérifié aujourd'hui sauf si ignoreThrottle=true).
   * Compare l'ETag distant avec l'ETag stocké pour détecter une mise à jour (AC1, AC3, AC5).
   */
  async checkForUpdate(
    modelId: string,
    downloadUrl: string,
    modelType: ModelType,
    ignoreThrottle = false,
  ): Promise<Result<ModelUpdateStatus>> {
    try {
      // 1. Throttle : si vérifiée aujourd'hui ET pas de force → retourner statut stocké
      if (!ignoreThrottle) {
        const checkNeeded = await this.isCheckNeeded(modelId, modelType);
        if (checkNeeded.type === 'success' && !checkNeeded.data) {
          const stored = await AsyncStorage.getItem(KEY_UPDATE_STATUS(modelType, modelId));
          return success((stored as ModelUpdateStatus | null) ?? 'up-to-date');
        }
      }

      // 2. HTTP HEAD request
      let remoteEtag: string | null = null;
      try {
        const response = await fetch(downloadUrl, {
          method: 'HEAD',
          redirect: 'follow',
        });
        if (!response.ok) {
          await this.saveCheckDate(modelId, modelType);
          await AsyncStorage.setItem(KEY_UPDATE_STATUS(modelType, modelId), 'check-failed');
          return success('check-failed');
        }
        // Essayer ETag d'abord, puis Last-Modified comme fallback
        remoteEtag =
          response.headers.get('ETag') ??
          response.headers.get('etag') ??
          response.headers.get('Last-Modified') ??
          response.headers.get('last-modified');
      } catch {
        await this.saveCheckDate(modelId, modelType);
        await AsyncStorage.setItem(KEY_UPDATE_STATUS(modelType, modelId), 'check-failed');
        return success('check-failed');
      }

      // 3. Comparer avec ETag stocké
      const storedEtag = await AsyncStorage.getItem(KEY_STORED_ETAG(modelType, modelId));

      let status: ModelUpdateStatus;
      if (remoteEtag === null) {
        // Source ne supporte pas ETag → statut unavailable
        status = 'unavailable';
      } else if (storedEtag === null) {
        // Premier check après migration (modèle téléchargé avant story 8.9)
        // → Stocker l'ETag actuel comme baseline, considérer à jour
        await AsyncStorage.setItem(KEY_STORED_ETAG(modelType, modelId), remoteEtag);
        status = 'up-to-date';
      } else if (storedEtag === remoteEtag) {
        status = 'up-to-date';
      } else {
        status = 'update-available';
      }

      // 4. Persister statut + date check
      await AsyncStorage.setItem(KEY_UPDATE_STATUS(modelType, modelId), status);
      await this.saveCheckDate(modelId, modelType);

      // 5. Migration : backfiller downloadDate/updateDate pour modèles pré-existants
      //    (téléchargés avant story 8.9 ou après wipe d'AsyncStorage)
      const existingDownloadDate = await AsyncStorage.getItem(KEY_DOWNLOAD_DATE(modelType, modelId));
      if (!existingDownloadDate) {
        const now = new Date().toISOString();
        await AsyncStorage.multiSet([
          [KEY_DOWNLOAD_DATE(modelType, modelId), now],
          [KEY_UPDATE_DATE(modelType, modelId), now],
        ]);
      }

      return success(status);
    } catch (error) {
      return unknownError<ModelUpdateStatus>(
        `checkForUpdate failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Enregistre l'application d'une mise à jour.
   * Met à jour updateDate et ETag stocké (AC6).
   */
  async recordUpdate(modelId: string, modelType: ModelType, downloadUrl: string): Promise<Result<void>> {
    try {
      await AsyncStorage.setItem(KEY_UPDATE_DATE(modelType, modelId), new Date().toISOString());
      // Effacer l'ancien ETag et le statut pour forcer un nouveau check
      await AsyncStorage.removeItem(KEY_STORED_ETAG(modelType, modelId));
      await AsyncStorage.removeItem(KEY_UPDATE_STATUS(modelType, modelId));
      // Stocker le nouvel ETag (best-effort)
      try {
        const response = await fetch(downloadUrl, { method: 'HEAD', redirect: 'follow' });
        const etag =
          response.headers.get('ETag') ??
          response.headers.get('etag') ??
          response.headers.get('Last-Modified');
        if (etag) {
          await AsyncStorage.setItem(KEY_STORED_ETAG(modelType, modelId), etag);
        }
        await AsyncStorage.setItem(KEY_UPDATE_STATUS(modelType, modelId), 'up-to-date');
      } catch {
        // Fail silently
      }
      return success(undefined);
    } catch (error) {
      return unknownError<void>(
        `recordUpdate failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retourne les informations d'affichage pour la carte du modèle (AC4).
   */
  async getUpdateInfo(modelId: string, modelType: ModelType): Promise<Result<ModelUpdateInfo>> {
    try {
      const [downloadDateStr, updateDateStr, lastCheckDateStr, statusStr] = await AsyncStorage.multiGet([
        KEY_DOWNLOAD_DATE(modelType, modelId),
        KEY_UPDATE_DATE(modelType, modelId),
        KEY_LAST_CHECK(modelType, modelId),
        KEY_UPDATE_STATUS(modelType, modelId),
      ]);

      const parseDate = (entry: readonly [string, string | null]): Date | null => {
        const val = entry[1];
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      const info: ModelUpdateInfo = {
        modelId,
        modelType,
        status: (statusStr[1] as ModelUpdateStatus | null) ?? null,
        downloadDate: parseDate(downloadDateStr),
        updateDate: parseDate(updateDateStr),
        lastCheckDate: parseDate(lastCheckDateStr),
      };

      return success(info);
    } catch (error) {
      return unknownError<ModelUpdateInfo>(
        `getUpdateInfo failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Supprime toutes les clés de tracking de mise à jour pour un modèle.
   * Appelé lors de la suppression physique du modèle.
   */
  async clearModelTracking(modelId: string, modelType: ModelType): Promise<Result<void>> {
    try {
      await AsyncStorage.multiRemove([
        KEY_DOWNLOAD_DATE(modelType, modelId),
        KEY_UPDATE_DATE(modelType, modelId),
        KEY_LAST_CHECK(modelType, modelId),
        KEY_STORED_ETAG(modelType, modelId),
        KEY_UPDATE_STATUS(modelType, modelId),
      ]);
      return success(undefined);
    } catch (error) {
      return unknownError<void>(
        `clearModelTracking failed for ${modelType}/${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Helpers privés
  // ──────────────────────────────────────────────────────────────────────────────

  private async saveCheckDate(modelId: string, modelType: ModelType): Promise<void> {
    await AsyncStorage.setItem(KEY_LAST_CHECK(modelType, modelId), new Date().toISOString());
  }
}
