/**
 * CaptureSyncBadge - Per-capture sync status badge
 *
 * Story 6.4 - Task 4: Visual sync indicator per capture in the list
 *
 * Shows the sync status of an individual capture based on its sync metadata fields.
 * Uses Capture.model.ts sync fields: serverId, lastSyncAt
 *
 * Rules:
 * - pending (⚡): capture has no serverId (never synced to server)
 * - synced (✓): capture has serverId (successfully pushed to server)
 *
 * @architecture Layer: UI Component (capture context)
 */

import React from 'react';
import { View, Text } from 'react-native';
import type { Capture } from '../contexts/capture/domain/Capture.model';

export interface CaptureSyncBadgeProps {
  capture: Pick<Capture, 'serverId' | 'lastSyncAt'>;
}

/**
 * Determines the sync status of a capture based on its metadata.
 */
function getCaptureSyncStatus(
  capture: Pick<Capture, 'serverId' | 'lastSyncAt'>
): 'pending' | 'synced' {
  if (!capture.serverId) {
    return 'pending';
  }
  return 'synced';
}

/**
 * CaptureSyncBadge Component
 *
 * Renders a small badge indicating capture sync status.
 * Compact design suitable for capture list cards.
 */
export const CaptureSyncBadge: React.FC<CaptureSyncBadgeProps> = ({ capture }) => {
  const syncStatus = getCaptureSyncStatus(capture);

  if (syncStatus === 'synced') {
    return (
      <View
        accessibilityLabel="Synchronisé"
        accessibilityRole="text"
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#dcfce7',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 10, color: '#10b981', fontWeight: 'bold' }}>✓</Text>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="En attente de synchronisation"
      accessibilityRole="text"
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#fef9c3',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 10, color: '#f59e0b' }}>⚡</Text>
    </View>
  );
};

export default CaptureSyncBadge;
