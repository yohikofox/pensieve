/**
 * Debug UI pour la queue de transcription
 *
 * Architecture (Event-Driven):
 * - Uses Zustand store (queueDebugStore) for reactive state
 * - QueueDebugStoreSync syncs EventBus events → Store
 * - NO polling, pure observer pattern
 * - Lifecycle: Mount → Start sync → Unmount → Stop sync (cleanup)
 *
 * Usage:
 * ```tsx
 * import { TranscriptionQueueDebug } from './components/dev/TranscriptionQueueDebug';
 *
 * export function CaptureScreen() {
 *   return (
 *     <View>
 *       <TranscriptionQueueDebug />
 *     </View>
 *   );
 * }
 * ```
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { container } from 'tsyringe';
import type { EventBus } from '../../contexts/shared/events/EventBus';
import { database } from '../../database';
import { useQueueDebugStore, type QueueItem } from './stores/queueDebugStore';
import { QueueDebugStoreSync } from './stores/QueueDebugStoreSync';

interface TranscriptionQueueDebugProps {
  alwaysExpanded?: boolean; // For fullscreen mode in DevPanel
}

export function TranscriptionQueueDebug({ alwaysExpanded = false }: TranscriptionQueueDebugProps) {
  // Zustand store - reactive state (no useState needed)
  const { items, stats } = useQueueDebugStore();
  const [isExpanded, setIsExpanded] = React.useState(alwaysExpanded);

  // Store sync lifecycle
  const syncRef = useRef<QueueDebugStoreSync | null>(null);

  useEffect(() => {
    // Mount: Create and start store sync
    const eventBus = container.resolve<EventBus>('EventBus');
    syncRef.current = new QueueDebugStoreSync(eventBus, database);
    syncRef.current.start();

    return () => {
      // Unmount: Stop sync and cleanup
      if (syncRef.current) {
        syncRef.current.stop();
        syncRef.current = null;
      }
    };
  }, []);

  const runDiagnostics = () => {
    console.log('\n=== TranscriptionQueue Diagnostics ===');
    const db = database.getDatabase();

    try {
      // Check if table exists
      const tableCheck = db.executeSync(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='transcription_queue'`
      );
      console.log('Table exists:', tableCheck.rows && tableCheck.rows.length > 0 ? 'YES' : 'NO');

      // Check recent audio captures
      const capturesResult = db.executeSync(
        `SELECT id, type, state, raw_content, created_at
         FROM captures
         WHERE type = 'audio'
         ORDER BY created_at DESC
         LIMIT 3`
      );
      console.log('Recent audio captures:', capturesResult.rows?.length || 0);
      console.log(capturesResult.rows);

      // Check queue items
      const queueResult = db.executeSync(`SELECT * FROM transcription_queue`);
      console.log('Queue items:', queueResult.rows?.length || 0);
      console.log(queueResult.rows);

      // Check for missing enqueues (captures that should be in queue but aren't)
      const missingResult = db.executeSync(
        `SELECT c.id, c.state, c.created_at
         FROM captures c
         LEFT JOIN transcription_queue tq ON c.id = tq.capture_id
         WHERE c.type = 'audio'
         AND c.state = 'captured'
         AND tq.id IS NULL`
      );
      console.log('Captures NOT in queue:', missingResult.rows?.length || 0);
      console.log(missingResult.rows);

      console.log('=== Diagnostics Complete ===\n');
      alert('Diagnostics logged to console - check Logs tab');
    } catch (error) {
      console.error('Diagnostics error:', error);
      alert('Diagnostics failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Don't show collapsed view if alwaysExpanded
  if (!isExpanded && !alwaysExpanded) {
    return (
      <TouchableOpacity
        style={styles.collapsedContainer}
        onPress={() => setIsExpanded(true)}
      >
        <Text style={styles.collapsedText}>
          🎙️ {stats.pending}P | Total: {stats.totalProcessed} {stats.isPaused ? '⏸️' : '▶️'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, alwaysExpanded && styles.containerFullscreen]}>
      <View style={styles.header}>
        <Text style={styles.title}>Transcription Queue Debug</Text>
        {!alwaysExpanded && (
          <TouchableOpacity onPress={() => setIsExpanded(false)}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.stats}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>In Queue:</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Processed:</Text>
          <Text style={[styles.statValue, { color: '#00ff00' }]}>{stats.totalProcessed}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Pending:</Text>
          <Text style={[styles.statValue, styles.pending]}>{stats.pending}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Processing:</Text>
          <Text style={[styles.statValue, styles.processing]}>{stats.processing}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Completed:</Text>
          <Text style={[styles.statValue, styles.completed]}>{stats.completed}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Failed:</Text>
          <Text style={[styles.statValue, styles.failed]}>{stats.failed}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Status:</Text>
          <Text style={styles.statValue}>
            {stats.isPaused ? '⏸️ PAUSED' : '▶️ RUNNING'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.itemsList}>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>Queue vide</Text>
        ) : (
          items.map((item: QueueItem) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemId}>#{item.id}</Text>
                <Text
                  style={[
                    styles.itemStatus,
                    item.status === 'pending' && styles.statusPending,
                    item.status === 'processing' && styles.statusProcessing,
                    item.status === 'completed' && styles.statusCompleted,
                    item.status === 'failed' && styles.statusFailed,
                  ]}
                >
                  {item.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.itemDetail}>
                Capture: {item.capture_id.substring(0, 8)}...
              </Text>
              <Text style={styles.itemDetail}>
                Duration: {item.audio_duration ? `${(item.audio_duration / 1000).toFixed(1)}s` : 'N/A'}
              </Text>
              <Text style={styles.itemDetail}>
                Created: {new Date(item.created_at).toLocaleTimeString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.diagnosticsButton} onPress={runDiagnostics}>
          <Text style={styles.refreshButtonText}>🔍 Diagnostics</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedContainer: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    zIndex: 9999,
  },
  collapsedText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    maxHeight: 400,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 12,
    padding: 12,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: '#444',
  },
  containerFullscreen: {
    position: 'relative',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: undefined,
    flex: 1,
    borderRadius: 0,
    zIndex: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#fff',
    fontSize: 20,
    paddingHorizontal: 8,
  },
  stats: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  pending: {
    color: '#ffa500',
  },
  processing: {
    color: '#00bfff',
  },
  completed: {
    color: '#00ff00',
  },
  failed: {
    color: '#ff0000',
  },
  itemsList: {
    maxHeight: 200,
  },
  emptyText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  item: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#444',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemId: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  itemStatus: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: '#ffa500',
    color: '#000',
  },
  statusProcessing: {
    backgroundColor: '#00bfff',
    color: '#000',
  },
  statusCompleted: {
    backgroundColor: '#00ff00',
    color: '#000',
  },
  statusFailed: {
    backgroundColor: '#ff0000',
    color: '#fff',
  },
  itemDetail: {
    color: '#ccc',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  buttonRow: {
    flexDirection: 'row',

    marginTop: 8,
  },
  refreshButton: {
    flex: 1,
    backgroundColor: '#444',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  diagnosticsButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
