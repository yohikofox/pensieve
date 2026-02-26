/**
 * InAppLogger - Dev-only log viewer for testing offline
 *
 * Architecture (Event-Driven):
 * - Uses Zustand store (logsDebugStore) for reactive state
 * - Console interception feeds logs to store
 * - Pure observer pattern, no manual polling
 *
 * Story 7.3: Adds "Analyze & Report Issue" button (AC1, AC4, AC8, AC9)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLogsDebugStore, type LogEntry } from './stores/logsDebugStore';
import { useSettingsStore, selectIsDebugModeEnabled } from '../../stores/settingsStore';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { IGitHubIssueService } from './services/GitHubIssueService';
import type { LogsAnalysisService } from './services/LogsAnalysisService';
import type { GitHubIssueAnalysis } from './services/LogsAnalysisService';
import { RepositoryResultType } from '../../contexts/shared/domain/Result';

/** State for the analysis modal (AC4) */
interface AnalysisModalState {
  visible: boolean;
  analysis: GitHubIssueAnalysis | null;
  editableTitle: string;
  isCreating: boolean;
  resultUrl: string | null;
  resultError: string | null;
}

const INITIAL_MODAL_STATE: AnalysisModalState = {
  visible: false,
  analysis: null,
  editableTitle: '',
  isCreating: false,
  resultUrl: null,
  resultError: null,
};

/**
 * LogsViewer - Embedded logs display for DevPanel
 * Story 7.3: Adds "Analyze & Report Issue" button (AC1, AC9)
 */
export const LogsViewer: React.FC = () => {
  // Zustand store - reactive state
  const { logs, sniffing, setSniffing, clearLogs, addLog } = useLogsDebugStore();
  const scrollRef = useRef<ScrollView>(null);
  const isDebugMode = useSettingsStore(selectIsDebugModeEnabled);
  const githubRepo = useSettingsStore((state) => state.githubRepo);

  // Story 7.3: Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [modalState, setModalState] = useState<AnalysisModalState>(INITIAL_MODAL_STATE);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && logs.length > 0) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [logs]);

  // AC1 + AC9: Button visible only when debug mode active AND errors exist
  const errorCount = logs.filter((l) => l.level === 'error').length;
  const showAnalyzeButton = isDebugMode && errorCount > 0;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const analysisService = container.resolve<LogsAnalysisService>(TOKENS.ILogsAnalysisService);
      const result = await analysisService.analyzeLogs(logs);

      if (result.type !== RepositoryResultType.SUCCESS || !result.data) {
        Alert.alert('Analyse échouée', result.error ?? 'Erreur inconnue');
        return;
      }

      setModalState({
        visible: true,
        analysis: result.data,
        editableTitle: result.data.title,
        isCreating: false,
        resultUrl: null,
        resultError: null,
      });
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Erreur inattendue');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!modalState.analysis) return;

    // Validate GitHub config
    const [owner, repo] = (githubRepo || '').split('/');
    if (!owner || !repo) {
      setModalState((s) => ({
        ...s,
        resultError: 'Configurez le dépôt GitHub dans Settings > Bug Reporting (format: owner/repo)',
      }));
      return;
    }

    setModalState((s) => ({ ...s, isCreating: true, resultUrl: null, resultError: null }));

    try {
      const githubService = container.resolve<IGitHubIssueService>(TOKENS.IGitHubIssueService);
      const result = await githubService.createIssue(
        owner,
        repo,
        modalState.editableTitle,
        modalState.analysis!.body,
        modalState.analysis!.labels
      );

      if (result.type === RepositoryResultType.SUCCESS && result.data) {
        const url = result.data.html_url;
        setModalState((s) => ({ ...s, resultUrl: url, isCreating: false }));
        // AC8: Log the result in DevPanel
        addLog({
          timestamp: new Date(),
          level: 'log',
          message: `[GitHubIssue] ✅ Issue créée: ${url}`,
        });
      } else {
        const errMsg = result.error ?? 'Erreur lors de la création de l\'issue';
        setModalState((s) => ({ ...s, resultError: errMsg, isCreating: false }));
        // AC8: Log the error in DevPanel
        addLog({
          timestamp: new Date(),
          level: 'error',
          message: `[GitHubIssue] ❌ Échec: ${errMsg}`,
        });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erreur inattendue';
      setModalState((s) => ({ ...s, resultError: errMsg, isCreating: false }));
    }
  };

  const handleCloseModal = () => {
    setModalState(INITIAL_MODAL_STATE);
  };

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

      {/* AC1: Analyze & Report Issue button — visible when debug mode + errors exist */}
      {showAnalyzeButton && (
        <TouchableOpacity
          style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]}
          onPress={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.analyzeButtonText}>
              🔍 Analyze & Report Issue ({errorCount} error{errorCount > 1 ? 's' : ''})
            </Text>
          )}
        </TouchableOpacity>
      )}

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
                {new Date(log.timestamp).toLocaleTimeString()}
              </Text>
              <Text style={styles.logMessage}>{log.message}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* AC4: Analysis preview modal */}
      <Modal
        visible={modalState.visible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔍 GitHub Issue Preview</Text>

            {/* Editable title (AC4) */}
            <Text style={styles.modalLabel}>Titre (éditable)</Text>
            <TextInput
              style={styles.titleInput}
              value={modalState.editableTitle}
              onChangeText={(text) => setModalState((s) => ({ ...s, editableTitle: text }))}
              placeholder="Titre de l'issue"
              placeholderTextColor="#888"
              maxLength={80}
            />

            {/* Labels & severity */}
            {modalState.analysis && (
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  Sévérité: <Text style={styles.metaBold}>{modalState.analysis.severity}</Text>
                </Text>
                <Text style={styles.metaText}>
                  Labels: <Text style={styles.metaBold}>{modalState.analysis.labels.join(', ')}</Text>
                </Text>
              </View>
            )}

            {/* Body preview */}
            <Text style={styles.modalLabel}>Contenu (preview)</Text>
            <ScrollView style={styles.bodyPreview}>
              <Text style={styles.bodyText}>{modalState.analysis?.body ?? ''}</Text>
            </ScrollView>

            {/* Result: URL or error (AC8) */}
            {modalState.resultUrl && (
              <View style={styles.resultSuccess}>
                <Text style={styles.resultSuccessText}>✅ Issue créée !</Text>
                <Text style={styles.resultUrl}>{modalState.resultUrl}</Text>
              </View>
            )}
            {modalState.resultError && (
              <View style={styles.resultError}>
                <Text style={styles.resultErrorText}>❌ {modalState.resultError}</Text>
              </View>
            )}

            {/* Action buttons — confirmation obligatoire (AC4) */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              {!modalState.resultUrl && (
                <TouchableOpacity
                  style={[styles.confirmButton, modalState.isCreating && styles.confirmButtonDisabled]}
                  onPress={handleCreateIssue}
                  disabled={modalState.isCreating}
                >
                  {modalState.isCreating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Créer l&apos;issue</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
                  {new Date(log.timestamp).toLocaleTimeString()}
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

  // Story 7.3: Analyze button (AC1)
  analyzeButton: {
    backgroundColor: '#5856D6',
    margin: 8,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  analyzeButtonDisabled: {
    opacity: 0.6,
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Story 7.3: Modal (AC4)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
    marginTop: 12,
  },
  titleInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#444',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  metaText: {
    color: '#aaa',
    fontSize: 12,
  },
  metaBold: {
    color: '#fff',
    fontWeight: '600',
  },
  bodyPreview: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 10,
    maxHeight: 150,
    marginTop: 4,
  },
  bodyText: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  resultSuccess: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#1a3a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2d7a2d',
  },
  resultSuccessText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  resultUrl: {
    color: '#81C784',
    fontSize: 12,
  },
  resultError: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#3a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7a2d2d',
  },
  resultErrorText: {
    color: '#ef5350',
    fontSize: 13,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#5856D6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
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

  },
  sniffingControl: {
    flexDirection: 'row',
    alignItems: 'center',

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
