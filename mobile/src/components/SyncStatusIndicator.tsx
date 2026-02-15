/**
 * SyncStatusIndicator Component
 *
 * Story 6.2 - Task 9.6: Sync status UI indicator
 *
 * Displays current sync status as a compact badge with icon/spinner.
 * Designed for integration in app header or tab bar.
 *
 * @architecture Layer: UI Component
 * @pattern Zustand consumption via hook
 */

import React from 'react';
import { View, Text, ActivityIndicator, type ViewStyle } from 'react-native';
import { useSyncStatusStore } from '@/stores/SyncStatusStore';

/**
 * Props for SyncStatusIndicator
 */
export interface SyncStatusIndicatorProps {
  /**
   * Show detailed text alongside icon (e.g., "Synced 2m ago")
   * Default: false (icon only)
   */
  showText?: boolean;

  /**
   * Custom container style
   */
  style?: ViewStyle;

  /**
   * Compact mode (smaller size for tab bar)
   * Default: false
   */
  compact?: boolean;
}

/**
 * SyncStatusIndicator Component
 *
 * @example Basic usage (icon only)
 * ```tsx
 * <SyncStatusIndicator />
 * ```
 *
 * @example With text
 * ```tsx
 * <SyncStatusIndicator showText />
 * ```
 *
 * @example Compact mode for tab bar
 * ```tsx
 * <SyncStatusIndicator compact />
 * ```
 */
export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  showText = false,
  style,
  compact = false,
}) => {
  const { status, pendingCount, errorMessage, getTimeSinceLastSync } =
    useSyncStatusStore();

  /**
   * Format time elapsed since last sync
   */
  const formatElapsedTime = (): string => {
    const seconds = getTimeSinceLastSync();
    if (seconds === null) return '';

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  /**
   * Render status icon/spinner
   */
  const renderIcon = () => {
    const iconSize = compact ? 14 : 18;

    switch (status) {
      case 'syncing':
        return <ActivityIndicator size="small" color="#3b82f6" />;

      case 'synced':
        return (
          <Text style={{ fontSize: iconSize, color: '#10b981' }}>✓</Text>
        );

      case 'pending':
        return (
          <View
            style={{
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
              backgroundColor: '#f59e0b',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: compact ? 8 : 10,
                color: '#ffffff',
                fontWeight: 'bold',
              }}
            >
              {pendingCount}
            </Text>
          </View>
        );

      case 'error':
        return (
          <Text style={{ fontSize: iconSize, color: '#ef4444' }}>!</Text>
        );

      default:
        return null;
    }
  };

  /**
   * Render status text
   */
  const renderText = () => {
    if (!showText) return null;

    const textSize = compact ? 10 : 12;

    switch (status) {
      case 'syncing':
        return (
          <Text style={{ fontSize: textSize, color: '#6b7280', marginLeft: 6 }}>
            Syncing...
          </Text>
        );

      case 'synced':
        return (
          <Text style={{ fontSize: textSize, color: '#6b7280', marginLeft: 6 }}>
            Synced {formatElapsedTime()}
          </Text>
        );

      case 'pending':
        return (
          <Text style={{ fontSize: textSize, color: '#6b7280', marginLeft: 6 }}>
            Pending ({pendingCount})
          </Text>
        );

      case 'error':
        return (
          <Text style={{ fontSize: textSize, color: '#ef4444', marginLeft: 6 }}>
            {errorMessage || 'Sync error'}
          </Text>
        );

      default:
        return null;
    }
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: compact ? 4 : 6,
        },
        style,
      ]}
    >
      {renderIcon()}
      {renderText()}
    </View>
  );
};

/**
 * Default export for convenience
 */
export default SyncStatusIndicator;
