/**
 * SyncStatusDetailModal - Detailed sync status modal
 *
 * Story 6.4 - Task 3: Display detailed sync status information
 *
 * Shows when user taps the SyncStatusIndicatorButton in the header.
 * Displays:
 * - Current sync status (with label)
 * - Last sync time (formatted)
 * - Pending count if applicable
 * - Error message if applicable
 * - "Sync Now" button to trigger manual sync
 *
 * @architecture Layer: UI Component
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { useSyncDetails } from '../hooks/useSyncDetails';
import { useManualSync } from '../hooks/useManualSync';

export interface SyncStatusDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

const styles: Record<string, ViewStyle> = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeButton: {
    padding: 8,
  },
  syncButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  syncButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
};

/**
 * SyncStatusDetailModal Component
 *
 * Bottom sheet modal showing detailed sync status.
 */
export const SyncStatusDetailModal: React.FC<SyncStatusDetailModalProps> = ({
  visible,
  onClose,
}) => {
  const details = useSyncDetails();
  const { triggerManualSync, isManualSyncing } = useManualSync();

  const handleSyncNow = async () => {
    await triggerManualSync();
    onClose();
  };

  const getStatusColor = () => {
    switch (details.status) {
      case 'syncing': return '#3b82f6';
      case 'synced': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Fermer"
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.row}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
              Statut de synchronisation
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer">
              <Text style={{ fontSize: 20, color: '#6b7280' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Status */}
          <View style={{ marginTop: 16 }}>
            <View style={styles.row}>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>État</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: getStatusColor() }}>
                {details.statusLabel}
              </Text>
            </View>

            {/* Last sync time */}
            <View style={styles.row}>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>Dernière sync</Text>
              <Text style={{ fontSize: 14, color: '#374151' }}>
                {details.lastSyncLabel}
              </Text>
            </View>

            {/* Pending count */}
            {details.pendingCount > 0 && (
              <View style={styles.row}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>En attente</Text>
                <Text style={{ fontSize: 14, color: '#f59e0b', fontWeight: '500' }}>
                  {details.pendingCount} élément{details.pendingCount > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Error message */}
            {details.errorMessage && (
              <View style={{ marginTop: 8, padding: 12, backgroundColor: '#fef2f2', borderRadius: 8 }}>
                <Text style={{ fontSize: 13, color: '#ef4444' }}>
                  {details.errorMessage}
                </Text>
              </View>
            )}
          </View>

          {/* Sync Now button */}
          <TouchableOpacity
            style={[
              styles.syncButton,
              isManualSyncing && styles.syncButtonDisabled,
            ]}
            onPress={handleSyncNow}
            disabled={isManualSyncing}
            accessibilityRole="button"
            accessibilityLabel="Synchroniser maintenant"
          >
            {isManualSyncing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>
                Synchroniser maintenant
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default SyncStatusDetailModal;
