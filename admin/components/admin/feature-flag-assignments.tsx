'use client';

import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { apiClient, FeatureItem, FeatureAssignment } from '@/lib/api-client';

type AssignmentTarget = 'role' | 'permission';

interface FeatureFlagAssignmentsProps {
  targetId: string;
  targetType: AssignmentTarget;
}

/**
 * FeatureFlagAssignments — Composant réutilisable pour gérer les assignations feature flags
 * Story 24.2: AC3 (rôles) + AC4 (permissions)
 *
 * Affiche la liste des features avec leur valeur assignée au rôle/permission.
 * Permet d'activer/désactiver une assignation via un toggle.
 * Si pas d'assignation : badge gris "non défini", toggle OFF mais distinctif.
 */
export function FeatureFlagAssignments({ targetId, targetType }: FeatureFlagAssignmentsProps) {
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [assignments, setAssignments] = useState<Map<string, boolean>>(new Map());
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [allFeatures, currentAssignments] = await Promise.all([
        apiClient.getAdminFeatures(),
        targetType === 'role'
          ? apiClient.getRoleFeatures(targetId)
          : apiClient.getPermissionFeatures(targetId),
      ]);
      setFeatures(allFeatures);
      const map = new Map<string, boolean>();
      for (const a of currentAssignments as FeatureAssignment[]) {
        map.set(a.featureKey, a.value);
      }
      setAssignments(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    }
  }, [targetId, targetType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggle(featureKey: string, currentValue: boolean | undefined) {
    setLoadingKey(featureKey);
    setError(null);
    try {
      if (currentValue === undefined) {
        // Pas d'assignation : créer avec true
        const newValue = true;
        if (targetType === 'role') {
          await apiClient.upsertRoleFeatureAssignment(targetId, featureKey, newValue);
        } else {
          await apiClient.upsertPermissionFeatureAssignment(targetId, featureKey, newValue);
        }
        setAssignments((prev) => new Map(prev).set(featureKey, newValue));
      } else {
        // Toggle la valeur existante
        const newValue = !currentValue;
        if (targetType === 'role') {
          await apiClient.upsertRoleFeatureAssignment(targetId, featureKey, newValue);
        } else {
          await apiClient.upsertPermissionFeatureAssignment(targetId, featureKey, newValue);
        }
        setAssignments((prev) => new Map(prev).set(featureKey, newValue));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleRemove(featureKey: string) {
    setLoadingKey(featureKey);
    setError(null);
    try {
      if (targetType === 'role') {
        await apiClient.deleteRoleFeatureAssignment(targetId, featureKey);
      } else {
        await apiClient.deletePermissionFeatureAssignment(targetId, featureKey);
      }
      setAssignments((prev) => {
        const next = new Map(prev);
        next.delete(featureKey);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setLoadingKey(null);
    }
  }

  if (features.length === 0) {
    return <p className="text-sm text-muted-foreground">Chargement des features...</p>;
  }

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">Feature Flags</Label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {features.map((feature) => {
        const assigned = assignments.get(feature.key);
        const isLoading = loadingKey === feature.key;
        const hasAssignment = assigned !== undefined;

        return (
          <div
            key={feature.key}
            className="flex items-center justify-between rounded-md border px-3 py-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{feature.key}</p>
                {hasAssignment ? (
                  <Badge variant={assigned ? 'default' : 'destructive'} className="text-xs">
                    {assigned ? 'true' : 'false'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    non défini
                  </Badge>
                )}
              </div>
              {feature.description && (
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={assigned === true}
                onCheckedChange={() => handleToggle(feature.key, assigned)}
                disabled={isLoading}
                className={!hasAssignment ? 'opacity-50' : undefined}
              />
              {hasAssignment && (
                <button
                  onClick={() => handleRemove(feature.key)}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:text-destructive ml-1"
                  title="Supprimer l'assignation"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
