/**
 * Query Builder Screen — Constructeur de requêtes SQL
 *
 * Écran principal du datamining : builder graphique + preview SQL + exécution + sauvegarde.
 * Accepte un paramètre optionnel `queryId` pour éditer une query existante.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { StandardLayout } from '../../components/layouts';
import { QueryBuilder } from '../../components/dev/datamining/QueryBuilder';
import { QueryResultView } from '../../components/dev/datamining/QueryResultView';
import type { QueryAst, SavedQuery } from '../../components/dev/datamining/QueryAst';
import { DEFAULT_QUERY_AST } from '../../components/dev/datamining/QueryAst';
import { queryAstToSql } from '../../components/dev/datamining/queryAstToSql';
import { database } from '../../database';
import type { SettingsStackParamList } from '../../navigation/SettingsStackNavigator';

type Props = NativeStackScreenProps<SettingsStackParamList, 'QueryBuilder'>;
type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'QueryBuilder'>;

interface RawSavedQuery {
  id: string;
  name: string;
  sql: string;
  query_ast: string;
  created_at: number;
  updated_at: number;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface QueryResult {
  rows?: Record<string, unknown>[];
  rowsAffected?: number;
}

export const QueryBuilderScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const queryId = route.params?.queryId;

  const [ast, setAst] = useState<QueryAst>(DEFAULT_QUERY_AST);
  const [sqlPreview, setSqlPreview] = useState<string>('-- Sélectionnez une table source');
  const [queryName, setQueryName] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Chargement de la query existante
  useEffect(() => {
    if (!queryId) return;
    try {
      const r = database.execute(
        'SELECT id, name, sql, query_ast, created_at, updated_at FROM debug_saved_queries WHERE id = ?',
        [queryId]
      ) as { rows?: RawSavedQuery[] };
      const row = r.rows?.[0];
      if (row) {
        const loadedAst: QueryAst = JSON.parse(row.query_ast);
        setAst(loadedAst);
        setQueryName(row.name);
        setSqlPreview(queryAstToSql(loadedAst));
      }
    } catch (e: unknown) {
      console.warn('[QueryBuilderScreen] Failed to load query:', e);
    }
  }, [queryId]);

  const handleAstChange = useCallback((newAst: QueryAst) => {
    setAst(newAst);
  }, []);

  const handleSqlChange = useCallback((sql: string) => {
    setSqlPreview(sql);
  }, []);

  const handleExecute = () => {
    const sql = sqlPreview.trim();
    if (!sql || sql.startsWith('--')) return;

    setError(null);
    setResult(null);
    setExecuting(true);

    try {
      const r = database.execute(sql) as QueryResult;
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuting(false);
    }
  };

  const handleSave = () => {
    const name = queryName.trim();
    if (!name) {
      Alert.alert('Nom requis', 'Veuillez saisir un nom pour la query.');
      return;
    }
    const sql = sqlPreview.trim();
    if (!sql || sql.startsWith('--')) {
      Alert.alert('Query vide', 'Veuillez configurer une query avant de sauvegarder.');
      return;
    }

    setSaving(true);
    try {
      const now = Date.now();
      if (queryId) {
        database.execute(
          'UPDATE debug_saved_queries SET name = ?, sql = ?, query_ast = ?, updated_at = ? WHERE id = ?',
          [name, sql, JSON.stringify(ast), now, queryId]
        );
      } else {
        const id = generateUUID();
        database.execute(
          'INSERT INTO debug_saved_queries (id, name, sql, query_ast, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [id, name, sql, JSON.stringify(ast), now, now]
        );
      }
      Alert.alert('Sauvegardé', `Query "${name}" sauvegardée avec succès.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Erreur de sauvegarde', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StandardLayout>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          {/* Nom de la query */}
          <TextInput
            className="border border-border-default rounded-lg px-3 py-2.5 text-base text-text-primary bg-bg-input mb-4"
            value={queryName}
            onChangeText={setQueryName}
            placeholder="Nom de la query..."
            placeholderTextColor="#9CA3AF"
          />

          {/* Builder sections */}
          <QueryBuilder
            initialAst={ast}
            onChange={handleAstChange}
            onSqlChange={handleSqlChange}
          />

          {/* Preview SQL */}
          <View className="mt-2 mb-3">
            <Text className="text-xs text-text-tertiary uppercase mb-1.5">Preview SQL</Text>
            <View className="border border-border-default rounded-lg p-3 bg-bg-secondary">
              <Text
                className="text-xs text-text-secondary font-mono"
                selectable
              >
                {sqlPreview}
              </Text>
            </View>
          </View>

          {/* Boutons Exécuter + Sauvegarder */}
          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
              className="flex-1 bg-primary-500 rounded-lg py-3 items-center flex-row justify-center"
              onPress={handleExecute}
              disabled={executing}
            >
              {executing
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text className="text-white font-semibold">▶ Exécuter</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 border border-primary-500 rounded-lg py-3 items-center flex-row justify-center"
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" />
                : <Text className="text-primary-500 font-semibold">💾 Sauvegarder</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Résultats */}
          {(result || error) && (
            <QueryResultView
              rows={result?.rows}
              rowsAffected={result?.rowsAffected}
              error={error}
            />
          )}

          {/* Bottom padding */}
          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </StandardLayout>
  );
};
