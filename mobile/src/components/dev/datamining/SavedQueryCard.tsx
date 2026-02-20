/**
 * Saved Query Card — Carte d'une query sauvegardée
 *
 * Affiche le nom et un aperçu SQL d'une query sauvegardée.
 * Actions : ouvrir dans le builder, supprimer.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { SavedQuery } from './QueryAst';

interface SavedQueryCardProps {
  query: SavedQuery;
  onOpen: (query: SavedQuery) => void;
  onDelete: (queryId: string) => void;
}

export const SavedQueryCard: React.FC<SavedQueryCardProps> = ({ query, onOpen, onDelete }) => {
  const createdDate = new Date(query.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  return (
    <View className="bg-bg-card border border-border-default rounded-lg p-3 mb-3">
      <View className="flex-row items-start justify-between">
        <TouchableOpacity className="flex-1 mr-2" onPress={() => onOpen(query)}>
          <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
            {query.name}
          </Text>
          <Text className="text-xs text-text-tertiary mt-0.5">{createdDate}</Text>
          <Text
            className="text-xs text-text-secondary font-mono mt-2 leading-relaxed"
            numberOfLines={3}
          >
            {query.sql}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="p-1"
          onPress={() => onDelete(query.id)}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text className="text-status-error text-lg">✕</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="mt-3 border border-primary-500 rounded-md py-1.5 px-3 items-center"
        onPress={() => onOpen(query)}
      >
        <Text className="text-primary-500 text-sm font-medium">Ouvrir dans le builder</Text>
      </TouchableOpacity>
    </View>
  );
};
