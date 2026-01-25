/**
 * CorrectionLearningDebug - Debug tool to inspect vocabulary learning
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {
  CorrectionLearningService,
  type CorrectionEntry,
} from '../../contexts/Normalization/services/CorrectionLearningService';

export function CorrectionLearningDebug() {
  const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadCorrections = async () => {
    const all = await CorrectionLearningService.getAllCorrections();
    setCorrections(all);
  };

  useEffect(() => {
    loadCorrections();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCorrections();
    setRefreshing(false);
  };

  const handleClear = async () => {
    await CorrectionLearningService.clear();
    setCorrections([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Correction Learning</Text>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <Text style={styles.statsText}>
          Total: {corrections.length} |
          Suggestions (2+): {corrections.filter(c => c.count >= 2).length}
        </Text>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {corrections.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucune correction enregistrée</Text>
            <Text style={styles.emptySubtext}>
              Modifiez et enregistrez un transcript pour commencer l'apprentissage
            </Text>
          </View>
        ) : (
          corrections.map((correction) => (
            <View
              key={correction.id}
              style={[
                styles.card,
                correction.count >= 2 && styles.cardSuggestion,
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.phrase}>"{correction.suggestedPhrase}"</Text>
                <View style={[
                  styles.countBadge,
                  correction.count >= 2 && styles.countBadgeActive,
                ]}>
                  <Text style={[
                    styles.countText,
                    correction.count >= 2 && styles.countTextActive,
                  ]}>
                    {correction.count}x
                  </Text>
                </View>
              </View>

              <Text style={styles.detail}>
                {correction.originalWord} → {correction.correctedWord}
              </Text>

              <Text style={styles.context}>
                Contexte: "{correction.contextBefore}" [MOT] "{correction.contextAfter}"
              </Text>

              <Text style={styles.meta}>
                Captures: {correction.captureIds.length} |
                Dernier: {new Date(correction.lastSeen).toLocaleString('fr-FR')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stats: {
    padding: 12,
    backgroundColor: '#2A2A2A',
  },
  statsText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#2A2A2A',
    margin: 8,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#666',
  },
  cardSuggestion: {
    borderLeftColor: '#4CAF50',
    backgroundColor: '#2A3A2A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  phrase: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeActive: {
    backgroundColor: '#4CAF50',
  },
  countText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  countTextActive: {
    color: '#FFF',
  },
  detail: {
    color: '#FFD54F',
    fontSize: 14,
    marginBottom: 4,
  },
  context: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 4,
  },
  meta: {
    color: '#666',
    fontSize: 11,
  },
});
