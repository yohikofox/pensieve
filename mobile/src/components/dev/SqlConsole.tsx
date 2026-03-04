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

  const renderResultContent = () => {
    if (!result) return null;

    if (result.rows && result.rows.length > 0) {
      return (
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
          <Text className="text-xs text-text-tertiary mb-2">
            {result.rows.length} ligne(s)
          </Text>
          {result.rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              className="mb-3 rounded-lg border border-border-default bg-bg-primary overflow-hidden"
            >
              {/* Card header */}
              <View className="px-3 py-1.5 bg-bg-secondary border-b border-border-default">
                <Text className="text-xs font-bold text-text-tertiary uppercase">
                  Ligne {rowIndex + 1}
                </Text>
              </View>
              {/* Key/value pairs */}
              {Object.entries(row).map(([key, val], i) => {
                const isNull = val === null || val === undefined;
                const display = isNull
                  ? 'NULL'
                  : typeof val === 'object'
                  ? JSON.stringify(val)
                  : String(val);
                return (
                  <View
                    key={key}
                    className={`flex-row px-3 py-2 ${i % 2 === 0 ? 'bg-bg-primary' : 'bg-bg-secondary'}`}
                  >
                    <Text className="text-xs font-semibold text-text-primary w-32 shrink-0 mr-2" numberOfLines={1}>
                      {key}
                    </Text>
                    <Text
                      className={`text-xs flex-1 font-mono ${isNull ? 'italic text-text-tertiary' : 'text-text-secondary'}`}
                      selectable
                    >
                      {display}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
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
