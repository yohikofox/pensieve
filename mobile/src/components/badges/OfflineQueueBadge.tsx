/**
 * OfflineQueueBadge Component
 * Story 4.4: Notifications de Progression IA
 * Task 10, Subtask 10.3: Show offline queue badge in feed
 *
 * AC8: Offline Queue Notification
 * - Display "Queued for when online" badge
 * - Show on capture cards when device is offline
 * - Clear when network returns
 */

import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../../design-system/tokens';

export interface OfflineQueueBadgeProps {
  /**
   * Whether to show the badge
   */
  visible: boolean;

  /**
   * Estimated time until processing can start (optional)
   * Will be shown if provided when online
   */
  estimatedWaitTimeMs?: number;

  /**
   * Custom badge style variant
   */
  variant?: 'default' | 'compact';

  /**
   * Test ID for testing
   */
  testID?: string;
}

/**
 * OfflineQueueBadge
 *
 * Displays a badge indicating that a capture is queued for processing
 * when the network returns (AC8).
 *
 * Usage:
 * ```tsx
 * <OfflineQueueBadge
 *   visible={isOffline && isCaptureQueued}
 *   estimatedWaitTimeMs={30000}
 * />
 * ```
 */
export const OfflineQueueBadge: React.FC<OfflineQueueBadgeProps> = ({
  visible,
  estimatedWaitTimeMs,
  variant = 'default',
  testID = 'offline-queue-badge',
}) => {
  if (!visible) {
    return null;
  }

  const isCompact = variant === 'compact';

  return (
    <View
      testID={testID}
      className={`flex-row items-center ${isCompact ? 'px-2 py-1' : 'px-3 py-2'} rounded-full`}
      style={{ backgroundColor: colors.warning[100] }}
    >
      {/* Offline Icon (📡 or 🔌) */}
      <Text className="text-xs mr-1">📡</Text>

      {/* Badge Text */}
      <Text
        className={`font-semibold ${isCompact ? 'text-xs' : 'text-sm'}`}
        style={{ color: colors.warning[700] }}
      >
        {isCompact ? 'Offline queue' : 'Queued for when online'}
      </Text>

      {/* Estimated wait time (if provided) */}
      {estimatedWaitTimeMs !== undefined && !isCompact && (
        <Text className="text-xs ml-2" style={{ color: colors.warning[600] }}>
          (~{Math.ceil(estimatedWaitTimeMs / 1000)}s)
        </Text>
      )}
    </View>
  );
};

/**
 * Helper function to format wait time
 * Can be used externally for consistency
 */
export const formatOfflineWaitTime = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes}min`;
};
