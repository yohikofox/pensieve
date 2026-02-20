/**
 * SQL Console — Dev Tool
 *
 * Composant de debug pour exécuter des requêtes SQL directement
 * sur la base de données OP-SQLite locale.
 *
 * Usage : visible uniquement en mode debug (debugMode && debugModeAccess)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { database } from '../../database';

interface ResultRow {
  [key: string]: unknown;
}

interface QueryResult {
  rows?: ResultRow[];
  rowsAffected?: number;
}

export const SqlConsole: React.FC = () => {
  const [sql, setSql] = useState('SELECT * FROM captures LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = () => {
    const trimmed = sql.trim();
    if (!trimmed) return;

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const r = database.execute(trimmed) as QueryResult;
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const columns = result?.rows && result.rows.length > 0
    ? Object.keys(result.rows[0])
    : [];

  const renderResultContent = () => {
    if (!result) return null;

    if (result.rows && result.rows.length > 0) {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header row */}
            <View className="flex-row border-b border-border-default bg-bg-secondary">
              {columns.map((col) => (
                <Text
                  key={col}
                  className="text-xs font-bold text-text-primary px-2 py-1.5 min-w-[80px]"
                  numberOfLines={1}
                >
                  {col}
                </Text>
              ))}
            </View>
            {/* Data rows */}
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              {result.rows!.map((row, rowIndex) => (
                <View
                  key={rowIndex}
                  className={`flex-row border-b border-border-subtle ${rowIndex % 2 === 0 ? 'bg-bg-primary' : 'bg-bg-secondary'}`}
                >
                  {columns.map((col) => {
                    const val = row[col];
                    const display = val === null || val === undefined
                      ? 'NULL'
                      : typeof val === 'object'
                      ? JSON.stringify(val)
                      : String(val);
                    return (
                      <Text
                        key={col}
                        className="text-xs text-text-secondary px-2 py-1 min-w-[80px]"
                        numberOfLines={2}
                      >
                        {display}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <Text className="text-xs text-text-tertiary mt-1">
              {result.rows!.length} ligne(s)
            </Text>
          </View>
        </ScrollView>
      );
    }

    if (result.rows && result.rows.length === 0) {
      return (
        <Text className="text-sm text-text-secondary italic mt-2">
          Aucun résultat
        </Text>
      );
    }

    if (result.rowsAffected !== undefined && result.rowsAffected !== null) {
      return (
        <Text className="text-sm text-status-success mt-2">
          ✓ {result.rowsAffected} ligne(s) affectée(s)
        </Text>
      );
    }

    return (
      <Text className="text-sm text-status-success mt-2">
        ✓ Requête exécutée
      </Text>
    );
  };

  return (
    <View className="flex-1 p-4">
      {/* SQL Input */}
      <TextInput
        multiline
        value={sql}
        onChangeText={setSql}
        placeholder="SELECT * FROM todos LIMIT 10"
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        className="border border-border-default rounded-lg p-3 text-sm text-text-primary bg-bg-input font-mono min-h-[120px]"
        style={{ textAlignVertical: 'top' }}
      />

      {/* Execute button */}
      <TouchableOpacity
        className="bg-primary-500 rounded-lg py-3 px-4 mt-3 items-center flex-row justify-center"
        onPress={handleExecute}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator size="small" color="#FFFFFF" />
          : <Text className="text-white font-semibold text-base">▶ Exécuter</Text>
        }
      </TouchableOpacity>

      {/* Error */}
      {error && (
        <View className="mt-3 p-3 bg-status-error/10 border border-status-error rounded-lg">
          <Text className="text-xs font-bold text-status-error mb-1">Erreur SQL</Text>
          <Text className="text-xs text-status-error font-mono">{error}</Text>
        </View>
      )}

      {/* Results */}
      {result && !error && (
        <View className="mt-3 border border-border-default rounded-lg p-2 flex-1">
          <Text className="text-xs font-semibold text-text-tertiary uppercase mb-2">Résultats</Text>
          {renderResultContent()}
        </View>
      )}
    </View>
  );
};
