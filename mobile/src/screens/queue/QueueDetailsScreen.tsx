/**
 * Queue Details Screen
 * Story 4.4: Notifications de Progression IA
 * Task 9: Queue Details Screen (AC6)
 *
 * AC6: Multi-Capture Progress Tracking
 * - Display list of captures in queue with position and estimated time
 * - Show currently processing capture with elapsed time
 * - Real-time updates via WebSocket
 * - Pull-to-refresh support
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../design-system/tokens';
import { Card } from '../../design-system/components';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface QueueItem {
  captureId: string;
  userId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuePosition?: number;
  elapsedMs?: number;
  estimatedRemainingMs?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export const QueueDetailsScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const locale = i18n.language === 'fr' ? fr : enUS;

  // State
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Load queue status from backend
   * Task 9, Subtask 9.2: Display list of captures in queue
   */
  const loadQueueStatus = async () => {
    try {
      // TODO: Replace with actual API call when backend endpoint is ready
      // const response = await fetch(`${apiConfig.baseUrl}/api/captures/queue-status`);
      // const data = await response.json();
      // setQueueItems(data.items);

      // Mock data for now (will be replaced with API call)
      const mockItems: QueueItem[] = [
        {
          captureId: 'capture-1',
          userId: 'user-1',
          status: 'processing',
          elapsedMs: 8500,
          estimatedRemainingMs: 3500,
          startedAt: new Date(Date.now() - 8500),
        },
        {
          captureId: 'capture-2',
          userId: 'user-1',
          status: 'queued',
          queuePosition: 1,
          estimatedRemainingMs: 15000,
        },
        {
          captureId: 'capture-3',
          userId: 'user-1',
          status: 'queued',
          queuePosition: 2,
          estimatedRemainingMs: 27000,
        },
      ];
      setQueueItems(mockItems);
    } catch (error) {
      console.error('[QueueDetails] Failed to load queue status:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Pull-to-refresh handler
   * Task 9, Subtask 9.4: Add refresh/pull-to-refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadQueueStatus();
    setRefreshing(false);
  };

  /**
   * Initialize on mount
   */
  useEffect(() => {
    loadQueueStatus();

    // TODO: Subscribe to WebSocket progress.update events for real-time updates
    // const socket = io(`${apiConfig.baseUrl}/knowledge`);
    // socket.emit('join-user-room', userId);
    // socket.on('progress.update', (event) => {
    //   updateQueueItem(event.captureId, event);
    // });
    // return () => socket.disconnect();
  }, []);

  /**
   * Format elapsed time
   */
  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  /**
   * Format estimated remaining time
   */
  const formatEstimated = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `~${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes}min`;
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status: QueueItem['status']) => {
    switch (status) {
      case 'processing':
        return colors.primary[600];
      case 'queued':
        return colors.warning[600];
      case 'completed':
        return colors.success[600];
      case 'failed':
        return colors.error[600];
    }
  };

  /**
   * Get status label
   */
  const getStatusLabel = (status: QueueItem['status']) => {
    switch (status) {
      case 'processing':
        return t('capture.status.processing');
      case 'queued':
        return t('capture.status.queued');
      case 'completed':
        return t('capture.status.ready');
      case 'failed':
        return t('capture.status.failed');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg-screen justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  // Filter items by status
  const processingItems = queueItems.filter((item) => item.status === 'processing');
  const queuedItems = queueItems.filter((item) => item.status === 'queued');

  return (
    <ScrollView
      className="flex-1 bg-bg-screen"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary[600]}
        />
      }
    >
      {/* Summary Header */}
      <View className="p-4 bg-bg-surface">
        <Text className="text-2xl font-bold text-text-primary mb-2">
          Queue Status
        </Text>
        <Text className="text-sm text-text-secondary">
          {processingItems.length > 0 && `Processing ${processingItems.length} • `}
          {queuedItems.length} in queue
        </Text>
      </View>

      {/* Currently Processing Section */}
      {processingItems.length > 0 && (
        <>
          <Text className="text-xs font-semibold text-text-tertiary uppercase px-4 mt-5 mb-2">
            Currently Processing
          </Text>
          {processingItems.map((item) => (
            <Card key={item.captureId} variant="elevated" className="mx-4 mb-3 p-4">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <View className="flex-row items-center mb-2">
                    <View
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: getStatusColor(item.status) }}
                    />
                    <Text className="text-sm font-semibold text-text-primary">
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                  <Text className="text-xs text-text-secondary mb-1">
                    Capture ID: {item.captureId.substring(0, 8)}...
                  </Text>
                  {item.elapsedMs !== undefined && (
                    <Text className="text-xs text-text-tertiary">
                      Elapsed: {formatElapsed(item.elapsedMs)}
                    </Text>
                  )}
                  {item.estimatedRemainingMs !== undefined && (
                    <Text className="text-xs text-text-tertiary">
                      Estimated: {formatEstimated(item.estimatedRemainingMs)}
                    </Text>
                  )}
                </View>
                {/* Pulsing animation indicator */}
                <View className="w-12 h-12 rounded-full bg-primary-100 items-center justify-center">
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Queue Section */}
      {queuedItems.length > 0 ? (
        <>
          <Text className="text-xs font-semibold text-text-tertiary uppercase px-4 mt-5 mb-2">
            In Queue ({queuedItems.length})
          </Text>
          {queuedItems.map((item, index) => (
            <Card key={item.captureId} variant="subtle" className="mx-4 mb-3 p-4">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <View className="flex-row items-center mb-2">
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center mr-2"
                      style={{ backgroundColor: colors.warning[100] }}
                    >
                      <Text className="text-xs font-bold text-warning-700">
                        {(item.queuePosition ?? index + 1)}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold text-text-primary">
                      Position #{item.queuePosition ?? index + 1}
                    </Text>
                  </View>
                  <Text className="text-xs text-text-secondary mb-1">
                    Capture ID: {item.captureId.substring(0, 8)}...
                  </Text>
                  {item.estimatedRemainingMs !== undefined && (
                    <Text className="text-xs text-text-tertiary">
                      Estimated wait: {formatEstimated(item.estimatedRemainingMs)}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : (
        processingItems.length === 0 && (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-lg text-text-secondary text-center">
              No captures in queue
            </Text>
            <Text className="text-sm text-text-tertiary text-center mt-2">
              All your captures have been processed!
            </Text>
          </View>
        )
      )}

      {/* Info Card */}
      <Card variant="subtle" className="mx-4 mt-5 mb-8 p-4">
        <Text className="text-xs text-text-secondary">
          💡 The queue updates automatically. Pull down to refresh manually.
        </Text>
      </Card>
    </ScrollView>
  );
};
