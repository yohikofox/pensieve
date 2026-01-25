/**
 * InAppLogger - Dev-only log viewer for testing offline
 *
 * Architecture (Event-Driven):
 * - Uses Zustand store (logsDebugStore) for reactive state
 * - Console interception feeds logs to store
 * - Pure observer pattern, no manual polling
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLogsDebugStore, type LogEntry } from './stores/logsDebugStore';

/**
 * LogsViewer - Embedded logs display for DevPanel
 */
export const LogsViewer: React.FC = () => {
  // Zustand store - reactive state
  const { logs, sniffing, setSniffing, clearLogs } = useLogsDebugStore();
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && logs.length > 0) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [logs]);

  if (!__DEV__) return null;

  return (
    <View style={styles.embeddedContainer}>
      {/* Header Controls */}
      <View style={styles.embeddedHeader}>
        <Text style={styles.embeddedTitle}>Dev Logs ({logs.length})</Text>
        <View style={styles.headerButtons}>
          <View style={styles.sniffingControl}>
            <Text style={styles.sniffingLabel}>Sniff</Text>
            <Switch
              value={sniffing}
              onValueChange={setSniffing}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={sniffing ? '#007AFF' : '#f4f3f4'}
            />
          </View>
          <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logs List */}
      <ScrollView
        ref={scrollRef}
        style={styles.logContainer}
        contentContainerStyle={styles.logContent}
      >
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No logs yet</Text>
            <Text style={styles.emptyStateSubtext}>
              {sniffing ? 'Waiting for console messages...' : 'Sniffing is disabled'}
            </Text>
          </View>
        ) : (
          logs.map((log: LogEntry, index: number) => (
            <View
              key={index}
              style={[
                styles.logEntry,
                log.level === 'error' && styles.logError,
                log.level === 'warn' && styles.logWarn,
              ]}
            >
              <Text style={styles.logTime}>
                {log.timestamp.toLocaleTimeString()}
              </Text>
              <Text style={styles.logMessage}>{log.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

/**
 * InAppLogger - Floating button + modal version
 * Kept for backward compatibility if needed elsewhere
 */
export const InAppLogger: React.FC = () => {
  const [visible, setVisible] = React.useState(false);
  const { logs, sniffing, setSniffing, clearLogs } = useLogsDebugStore();
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when modal is visible
  useEffect(() => {
    if (visible && scrollRef.current && logs.length > 0) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [logs, visible]);

  if (!__DEV__) return null;

  return (
    <>
      {/* Floating button to open logs */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.floatingButtonText}>{logs.length}</Text>
      </TouchableOpacity>

      {/* Log viewer modal */}
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Dev Logs ({logs.length})</Text>
            <View style={styles.headerButtons}>
              <View style={styles.sniffingControl}>
                <Text style={styles.sniffingLabel}>Sniff</Text>
                <Switch
                  value={sniffing}
                  onValueChange={setSniffing}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={sniffing ? '#007AFF' : '#f4f3f4'}
                />
              </View>
              <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.logContainer}
            contentContainerStyle={styles.logContent}
          >
            {logs.map((log: LogEntry, index: number) => (
              <View
                key={index}
                style={[
                  styles.logEntry,
                  log.level === 'error' && styles.logError,
                  log.level === 'warn' && styles.logWarn,
                ]}
              >
                <Text style={styles.logTime}>
                  {log.timestamp.toLocaleTimeString()}
                </Text>
                <Text style={styles.logMessage}>{log.message}</Text>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Embedded version styles (for DevPanel)
  embeddedContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  embeddedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  embeddedTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },

  // Original floating button + modal styles
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 9999,
  },
  floatingButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sniffingControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sniffingLabel: {
    color: '#fff',
    fontSize: 14,
  },
  clearButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
  },
  logContent: {
    padding: 8,
  },
  logEntry: {
    padding: 8,
    marginBottom: 4,
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  logError: {
    borderLeftColor: '#ff3b30',
    backgroundColor: '#2a1a1a',
  },
  logWarn: {
    borderLeftColor: '#ff9500',
    backgroundColor: '#2a2410',
  },
  logTime: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
  logMessage: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
