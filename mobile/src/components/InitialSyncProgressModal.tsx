/**
 * InitialSyncProgressModal
 * Story 6.3 - Task 1.4: Progress Indicator UI
 *
 * Displays initial sync progress with percentage
 */

import React from 'react';
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export interface InitialSyncProgressModalProps {
  visible: boolean;
  progress: number; // 0-100
}

export const InitialSyncProgressModal: React.FC<InitialSyncProgressModalProps> = ({
  visible,
  progress,
}) => {
  // Don't render anything when not visible (optimization + test fix)
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.title}>Syncing your data...</Text>
          <Text style={styles.percentage}>{progress}%</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    color: '#000',
  },
  percentage: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#007AFF',
  },
});
