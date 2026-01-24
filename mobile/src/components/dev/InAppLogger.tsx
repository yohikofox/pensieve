/**
 * InAppLogger - Dev-only log viewer for testing offline
 * Shows console.log messages in-app when Metro disconnected
 */

import React, { useState, useEffect, useRef } from 'react';
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

interface LogEntry {
  timestamp: Date;
  level: 'log' | 'error' | 'warn';
  message: string;
}

export const InAppLogger: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sniffing, setSniffing] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Only in DEV mode
    if (!__DEV__) return;

    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      if (sniffing) {
        setLogs(prev => [...prev, { timestamp: new Date(), level: 'log', message }]);
      }
      originalLog(...args);
    };

    console.error = (...args) => {
      const message = args.map(arg => String(arg)).join(' ');
      if (sniffing) {
        setLogs(prev => [...prev, { timestamp: new Date(), level: 'error', message }]);
      }
      originalError(...args);
    };

    console.warn = (...args) => {
      const message = args.map(arg => String(arg)).join(' ');
      if (sniffing) {
        setLogs(prev => [...prev, { timestamp: new Date(), level: 'warn', message }]);
      }
      originalWarn(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [sniffing]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (visible && scrollRef.current) {
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
        <Text style={styles.floatingButtonText}>📋 {logs.length}</Text>
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
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setLogs([])}
              >
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
            {logs.map((log, index) => (
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
