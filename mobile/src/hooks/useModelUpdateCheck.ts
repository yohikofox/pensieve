/**
 * Hook d'orchestration pour la vérification des mises à jour des modèles.
 *
 * Gère la logique d'orchestration pour un écran de settings (LLM ou Whisper) :
 * - Charge l'état initial depuis AsyncStorage (sans réseau)
 * - Déclenche les checks nécessaires en arrière-plan au mount (throttled)
 * - Expose checkAll() pour la vérification manuelle (force, ignore throttle)
 *
 * Story: 8.9 — Vérification Automatique des Mises à Jour des Modèles (AC1, AC2, AC3)
 * ADR: ADR-021 (Transient First — lazy resolution), ADR-023 (Result Pattern)
 */

import { useState, useCallback, useEffect } from 'react';
import { container } from 'tsyringe';
import { TOKENS } from '../infrastructure/di/tokens';
import type { IModelUpdateCheckService } from '../contexts/Normalization/domain/IModelUpdateCheckService';
import type { ModelUpdateInfo, ModelType } from '../contexts/Normalization/domain/IModelUpdateCheckService';
import type { IModelDownloadNotificationService } from '../contexts/Normalization/domain/IModelDownloadNotificationService';
import { RepositoryResultType } from '../contexts/shared/domain/Result';

export type { ModelUpdateInfo, ModelType };

/**
 * Hook d'orchestration pour la vérification des mises à jour des modèles.
 *
 * Usage:
 *   const { updateInfoMap, isChecking, checkAll } = useModelUpdateCheck(downloadedModels, 'llm');
 *
 * @param models - Liste des modèles téléchargés avec leurs IDs et downloadUrls
 * @param modelType - 'llm' | 'whisper'
 */
export function useModelUpdateCheck(
  models: Array<{ modelId: string; modelName: string; downloadUrl: string }>,
  modelType: ModelType,
) {
  const [updateInfoMap, setUpdateInfoMap] = useState<Record<string, ModelUpdateInfo>>({});
  const [isChecking, setIsChecking] = useState(false);

  const getService = () => container.resolve<IModelUpdateCheckService>(TOKENS.IModelUpdateCheckService);
  const getNotifService = () => container.resolve<IModelDownloadNotificationService>(TOKENS.IModelDownloadNotificationService);

  // Charge l'état initial depuis AsyncStorage (sans réseau)
  const loadStoredInfo = useCallback(async () => {
    const service = getService();
    const entries = await Promise.all(
      models.map(async ({ modelId }) => {
        const result = await service.getUpdateInfo(modelId, modelType);
        return [modelId, result.type === RepositoryResultType.SUCCESS ? result.data : null] as const;
      }),
    );
    setUpdateInfoMap(Object.fromEntries(entries.filter(([, v]) => v !== null)));
  }, [models, modelType]);

  // Auto-check au mount (throttled)
  const autoCheckAll = useCallback(async () => {
    const service = getService();
    const notifService = getNotifService();
    for (const { modelId, modelName, downloadUrl } of models) {
      const needed = await service.isCheckNeeded(modelId, modelType);
      if (needed.type !== RepositoryResultType.SUCCESS || !needed.data) continue;

      const result = await service.checkForUpdate(modelId, downloadUrl, modelType);
      if (result.type === RepositoryResultType.SUCCESS) {
        if (result.data === 'update-available') {
          await notifService.notifyUpdateAvailable(modelId, modelName, modelType === 'llm' ? 'llm' : 'whisper');
        }
        // Refresh info pour UI
        const info = await service.getUpdateInfo(modelId, modelType);
        if (info.type === RepositoryResultType.SUCCESS) {
          setUpdateInfoMap(prev => ({ ...prev, [modelId]: info.data }));
        }
      }
    }
  }, [models, modelType]);

  // Clé stable dérivée des IDs — ne change que quand le set de modèles change
  const modelsKey = models.map(m => m.modelId).join(',');

  useEffect(() => {
    if (models.length === 0) return;
    loadStoredInfo().then(() => {
      autoCheckAll();
    });
  }, [modelsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check manuel (force, ignore throttle)
  const checkAll = useCallback(async () => {
    setIsChecking(true);
    const service = getService();
    const notifService = getNotifService();
    try {
      for (const { modelId, modelName, downloadUrl } of models) {
        // Lire le statut AVANT le check pour éviter le spam de notifications (AC5 : une seule notif par détection)
        const prevInfo = await service.getUpdateInfo(modelId, modelType);
        const wasAlreadyUpdateAvailable =
          prevInfo.type === RepositoryResultType.SUCCESS &&
          prevInfo.data?.status === 'update-available';

        const result = await service.checkForUpdate(modelId, downloadUrl, modelType, true);
        // N'envoyer la notification que si le statut CHANGE vers 'update-available' (pas déjà notifié)
        if (
          result.type === RepositoryResultType.SUCCESS &&
          result.data === 'update-available' &&
          !wasAlreadyUpdateAvailable
        ) {
          await notifService.notifyUpdateAvailable(modelId, modelName, modelType === 'llm' ? 'llm' : 'whisper');
        }
        const info = await service.getUpdateInfo(modelId, modelType);
        if (info.type === RepositoryResultType.SUCCESS) {
          setUpdateInfoMap(prev => ({ ...prev, [modelId]: info.data }));
        }
      }
    } finally {
      setIsChecking(false);
    }
  }, [models, modelType]);

  return { updateInfoMap, isChecking, checkAll };
}
