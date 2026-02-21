/**
 * DataMining Screen — Liste des queries sauvegardées
 *
 * Affiche toutes les queries sauvegardées dans debug_saved_queries.
 * Permet de créer une nouvelle query ou d'ouvrir une query existante.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StandardLayout } from '../../components/layouts';
import { SavedQueryCard } from '../../components/dev/datamining/SavedQueryCard';
import type { SavedQuery } from '../../components/dev/datamining/QueryAst';
import { database } from '../../database';
import type { SettingsStackParamList } from '../../navigation/SettingsNavigationTypes';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'DataMining'>;

interface RawSavedQuery {
  id: string;
  name: string;
  sql: string;
  query_ast: string;
  created_at: number;
  updated_at: number;
}

function loadSavedQueries(): SavedQuery[] {
  try {
    const r = database.execute(
      'SELECT id, name, sql, query_ast, created_at, updated_at FROM debug_saved_queries ORDER BY updated_at DESC'
    ) as { rows?: RawSavedQuery[] };
    return (r.rows || []).map((row) => ({
      ...row,
      query_ast: JSON.parse(row.query_ast),
    }));
  } catch {
    return [];
  }
}

export const DataMiningScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [queries, setQueries] = useState<SavedQuery[]>([]);

  useFocusEffect(
    useCallback(() => {
      setQueries(loadSavedQueries());
    }, [])
  );

  const handleOpen = (query: SavedQuery) => {
    navigation.navigate('QueryBuilder', { queryId: query.id });
  };

  const handleDelete = (queryId: string) => {
    Alert.alert(
      'Supprimer la query',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            try {
              database.execute('DELETE FROM debug_saved_queries WHERE id = ?', [queryId]);
              setQueries((prev) => prev.filter((q) => q.id !== queryId));
            } catch (e: unknown) {
              Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  };

  return (
    <StandardLayout>
      <View className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-text-primary">
            📊 Queries sauvegardées
          </Text>
          <TouchableOpacity
            className="bg-primary-500 rounded-lg px-4 py-2"
            onPress={() => navigation.navigate('QueryBuilder', {})}
          >
            <Text className="text-white font-semibold text-sm">+ Nouvelle</Text>
          </TouchableOpacity>
        </View>

        {/* Liste */}
        {queries.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-text-tertiary text-sm italic text-center">
              Aucune query sauvegardée.{'\n'}
              Créez-en une nouvelle pour commencer.
            </Text>
          </View>
        ) : (
          <FlatList
            data={queries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SavedQueryCard
                query={item}
                onOpen={handleOpen}
                onDelete={handleDelete}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </StandardLayout>
  );
};
