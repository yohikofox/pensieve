/**
 * PATListItem — Élément de liste d'un Personal Access Token
 * Story 27.2
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Pat, PatStatus } from '../../../../hooks/pat/types';

function getPatStatus(pat: Pat): PatStatus {
  if (pat.revokedAt) return 'revoked';
  if (new Date(pat.expiresAt) < new Date()) return 'expired';
  return 'active';
}

const STATUS_BADGE: Record<PatStatus, { label: string; className: string; color: string }> = {
  active: { label: 'Actif', className: 'bg-green-100', color: '#16a34a' },
  expired: { label: 'Expiré', className: 'bg-gray-100', color: '#6b7280' },
  revoked: { label: 'Révoqué', className: 'bg-red-100', color: '#dc2626' },
};

interface PATListItemProps {
  pat: Pat;
  onEdit?: (pat: Pat) => void;
  onRenew?: (pat: Pat) => void;
  onRevoke?: (pat: Pat) => void;
  disabled?: boolean;
}

export const PATListItem: React.FC<PATListItemProps> = ({
  pat,
  onEdit,
  onRenew,
  onRevoke,
  disabled = false,
}) => {
  const status = getPatStatus(pat);
  const badge = STATUS_BADGE[status];
  const isActive = status === 'active';

  const expiresLabel = isActive
    ? `Expire le ${new Date(pat.expiresAt).toLocaleDateString('fr-FR')}`
    : status === 'expired'
    ? `Expiré le ${new Date(pat.expiresAt).toLocaleDateString('fr-FR')}`
    : `Révoqué le ${new Date(pat.revokedAt!).toLocaleDateString('fr-FR')}`;

  return (
    <View className="py-3 px-4 border-b border-border-default">
      {/* Header: nom + badge */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-base font-semibold text-text-primary flex-1 mr-2" numberOfLines={1}>
          {pat.name}
        </Text>
        <View className={`px-2 py-0.5 rounded-full ${badge.className}`}>
          <Text style={{ color: badge.color, fontSize: 12, fontWeight: '600' }}>
            {badge.label}
          </Text>
        </View>
      </View>

      {/* Prefix */}
      <Text className="text-xs text-text-tertiary font-mono mb-1">{pat.prefix}…</Text>

      {/* Scopes */}
      <View className="flex-row flex-wrap gap-1 mb-1">
        {pat.scopes.map((scope) => (
          <View key={scope} className="bg-indigo-50 rounded px-1.5 py-0.5">
            <Text className="text-xs text-indigo-700">{scope}</Text>
          </View>
        ))}
      </View>

      {/* Dates */}
      <Text className="text-xs text-text-tertiary">{expiresLabel}</Text>
      {pat.lastUsedAt && (
        <Text className="text-xs text-text-tertiary">
          Dernière utilisation : {new Date(pat.lastUsedAt).toLocaleDateString('fr-FR')}
        </Text>
      )}

      {/* Actions — uniquement pour les PATs actifs */}
      {isActive && !disabled && (
        <View className="flex-row mt-2 gap-3">
          {onEdit && (
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => onEdit(pat)}
              accessibilityLabel="Modifier le token"
            >
              <Feather name="edit-2" size={14} color="#6366f1" style={{ marginRight: 4 }} />
              <Text className="text-sm text-indigo-600">Modifier</Text>
            </TouchableOpacity>
          )}
          {onRenew && (
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => onRenew(pat)}
              accessibilityLabel="Renouveler le token"
            >
              <Feather name="refresh-cw" size={14} color="#0891b2" style={{ marginRight: 4 }} />
              <Text className="text-sm text-cyan-600">Renouveler</Text>
            </TouchableOpacity>
          )}
          {onRevoke && (
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => onRevoke(pat)}
              accessibilityLabel="Révoquer le token"
            >
              <Feather name="trash-2" size={14} color="#dc2626" style={{ marginRight: 4 }} />
              <Text className="text-sm text-red-600">Révoquer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};
