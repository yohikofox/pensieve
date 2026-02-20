/**
 * Query Result View — Tableau de résultats réutilisable
 *
 * Affiche les résultats d'une requête SQL sous forme de tableau scrollable.
 * Partagé entre SqlConsole et le Query Builder.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';

interface ResultRow {
  [key: string]: unknown;
}

interface QueryResultViewProps {
  rows?: ResultRow[];
  rowsAffected?: number;
  error?: string | null;
}

export const QueryResultView: React.FC<QueryResultViewProps> = ({ rows, rowsAffected, error }) => {
  if (error) {
    return (
      <View className="mt-3 p-3 bg-status-error/10 border border-status-error rounded-lg">
        <Text className="text-xs font-bold text-status-error mb-1">Erreur SQL</Text>
        <Text className="text-xs text-status-error font-mono">{error}</Text>
      </View>
    );
  }

  if (rows && rows.length > 0) {
    const columns = Object.keys(rows[0]);
    return (
      <View className="border border-border-default rounded-lg overflow-hidden">
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
            {rows.map((row, rowIndex) => (
              <View
                key={rowIndex}
                className={`flex-row border-b border-border-subtle ${rowIndex % 2 === 0 ? 'bg-bg-primary' : 'bg-bg-secondary'}`}
              >
                {columns.map((col) => {
                  const val = row[col];
                  const display =
                    val === null || val === undefined
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
          </View>
        </ScrollView>
        <Text className="text-xs text-text-tertiary p-2">
          {rows.length} ligne(s)
        </Text>
      </View>
    );
  }

  if (rows && rows.length === 0) {
    return (
      <Text className="text-sm text-text-secondary italic mt-2">
        Aucun résultat
      </Text>
    );
  }

  if (rowsAffected !== undefined && rowsAffected !== null) {
    return (
      <Text className="text-sm text-status-success mt-2">
        ✓ {rowsAffected} ligne(s) affectée(s)
      </Text>
    );
  }

  return null;
};
