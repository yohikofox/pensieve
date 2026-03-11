/**
 * TranscriptionQueueManagementScreen - Gestion de la file de transcription locale
 *
 * Affiche l'état de la file de transcription locale (OP-SQLite)
 * et permet de forcer l'annulation des captures bloquées.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { container } from 'tsyringe';
import { TranscriptionQueueService, type QueuedCapture } from '../../contexts/Normalization/services/TranscriptionQueueService';
import { TranscriptionWorker } from '../../contexts/Normalization/workers/TranscriptionWorker';
import { useTheme } from '../../hooks/useTheme';
import { StandardLayout } from '../../components/layouts';
import { colors } from '../../design-system/tokens';

const getThemeColors = (isDark: boolean) => ({
  screenBg: isDark ? colors.neutral[900] : '#F2F2F7',
  cardBg: isDark ? colors.neutral[800] : colors.neutral[0],
  textPrimary: isDark ? colors.neutral[100] : colors.neutral[900],
  textSecondary: isDark ? colors.neutral[400] : colors.neutral[500],
  border: isDark ? colors.neutral[700] : colors.neutral[200],
  destructive: colors.error[500],
  emptyStateBg: isDark ? colors.neutral[800] : colors.neutral[50],
});

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning[500],
  processing: colors.primary[500],
  failed: colors.error[500],
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  processing: 'En cours',
  failed: 'Échoué',
};

function formatElapsed(startedAt?: Date): string {
  if (!startedAt) return '—';
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  return `${Math.floor(elapsed / 60)}min ${elapsed % 60}s`;
}

function QueueItemCard({
  item,
  themeColors,
  onAbort,
  aborting,
}: {
  item: QueuedCapture;
  themeColors: ReturnType<typeof getThemeColors>;
  onAbort: (captureId: string) => void;
  aborting: boolean;
}) {
  const statusColor = STATUS_COLORS[item.status] ?? colors.neutral[400];
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;

  return (
    <View style={[styles.card, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        {item.status === 'processing' && (
          <ActivityIndicator size="small" color={statusColor} style={styles.spinner} />
        )}
      </View>

      <Text style={[styles.captureId, { color: themeColors.textSecondary }]} numberOfLines={1}>
        {item.captureId}
      </Text>

      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
          Tentatives : {item.retryCount} · Resets : {item.resetCount}
        </Text>
        {item.status === 'processing' && (
          <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
            Durée : {formatElapsed(item.startedAt)}
          </Text>
        )}
      </View>

      {item.lastError ? (
        <Text style={[styles.errorText, { color: themeColors.destructive }]} numberOfLines={2}>
          {item.lastError}
        </Text>
      ) : null}

      {(item.status === 'processing' || item.status === 'pending') && (
        <TouchableOpacity
          style={[styles.abortButton, { borderColor: themeColors.destructive }]}
          onPress={() => onAbort(item.captureId)}
          disabled={aborting}
        >
          {aborting ? (
            <ActivityIndicator size="small" color={themeColors.destructive} />
          ) : (
            <Text style={[styles.abortButtonText, { color: themeColors.destructive }]}>
              Annuler
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export function TranscriptionQueueManagementScreen() {
  const { isDark } = useTheme();
  const themeColors = getThemeColors(isDark);

  const [items, setItems] = useState<QueuedCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [abortingId, setAbortingId] = useState<string | null>(null);

  const queueService = container.resolve(TranscriptionQueueService);
  const worker = container.resolve(TranscriptionWorker);

  const loadItems = useCallback(() => {
    try {
      const allItems = queueService.getAllQueueItems();
      setItems(allItems);
    } catch (err) {
      console.error('[QueueManagement] Failed to load queue items:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queueService]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems();
  }, [loadItems]);

  const handleAbort = useCallback((captureId: string) => {
    Alert.alert(
      'Annuler la transcription',
      'Cette capture sera marquée comme bloquée. Voulez-vous continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            setAbortingId(captureId);
            try {
              await worker.forceAbortCapture(captureId);
              loadItems();
            } catch (err) {
              console.error('[QueueManagement] Abort failed:', err);
              Alert.alert('Erreur', "Impossible d'annuler la transcription.");
            } finally {
              setAbortingId(null);
            }
          },
        },
      ],
    );
  }, [worker, loadItems]);

  if (loading) {
    return (
      <StandardLayout>
        <View style={[styles.centered, { backgroundColor: themeColors.screenBg }]}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </StandardLayout>
    );
  }

  return (
    <StandardLayout>
      <ScrollView
        style={[styles.container, { backgroundColor: themeColors.screenBg }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          FILE DE TRANSCRIPTION LOCALE
        </Text>

        {items.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: themeColors.emptyStateBg, borderColor: themeColors.border }]}>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              File vide
            </Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
              Aucune capture en attente de transcription.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              themeColors={themeColors}
              onAbort={handleAbort}
              aborting={abortingId === item.captureId}
            />
          ))
        )}

        <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
          Les captures bloquées (reset ≥ 3) sont automatiquement marquées comme échouées au prochain démarrage.
          Vous pouvez forcer l'annulation manuellement via le bouton "Annuler".
        </Text>
      </ScrollView>
    </StandardLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 4,
  },
  captureId: {
    fontSize: 11,
    fontFamily: 'Courier',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  abortButton: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  abortButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginHorizontal: 4,
  },
});
