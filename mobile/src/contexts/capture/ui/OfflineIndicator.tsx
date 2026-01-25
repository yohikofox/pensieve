/**
 * OfflineIndicator - Global Offline Mode Banner
 *
 * Displays offline mode banner in app header showing:
 * - Count of pending syncs
 * - Reassurance message: "Your captures are safe locally"
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC3: Fast Local Cache Access
 * Task 7.2: Show global offline indicator
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { container } from "tsyringe";
import { TOKENS } from "../../../infrastructure/di/tokens";
import type { ISyncQueueService } from "../domain/ISyncQueueService";

export interface OfflineIndicatorProps {
  /** Optional callback when user taps the banner */
  onPress?: () => void;
  /** Whether to show even when online (for testing) */
  forceShow?: boolean;
}

/**
 * OfflineIndicator Component
 *
 * Automatically shows when:
 * - Device is offline AND pending syncs > 0
 * - OR forceShow is true
 *
 * Usage:
 * ```tsx
 * <OfflineIndicator />
 * <OfflineIndicator onPress={() => navigation.navigate('SyncStatus')} />
 * ```
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  onPress,
  forceShow = false,
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Monitor network connectivity - SIMPLE VERSION THAT WORKS
   */
  useEffect(() => {
    console.log("[OfflineIndicator] Mounted");

    const interval = setInterval(async () => {
      try {
        // Check network
        const netState = await NetInfo.fetch();
        const online = netState.isConnected ?? true;
        setIsOnline(online);

        // Check pending count
        const syncQueueService = container.resolve<ISyncQueueService>(
          TOKENS.ISyncQueueService,
        );
        const count = await syncQueueService.getQueueSize();
        setPendingCount(count);

        // console.log("[OfflineIndicator] Poll:", { online, count });
      } catch (error) {
        console.error("[OfflineIndicator] Poll error:", error);
      }
    }, 3000); // Every 3 seconds

    // Initial check immediately
    (async () => {
      try {
        const netState = await NetInfo.fetch();
        setIsOnline(netState.isConnected ?? true);
        const syncQueueService = container.resolve<ISyncQueueService>(
          TOKENS.ISyncQueueService,
        );
        const count = await syncQueueService.getQueueSize();
        setPendingCount(count);
        setIsLoading(false);
      } catch (error) {
        console.error("[OfflineIndicator] Init error:", error);
        setIsLoading(false);
      }
    })();

    return () => clearInterval(interval);
  }, []);

  /**
   * Decide whether to show indicator
   * Show if:
   * - forceShow is true, OR
   * - Device is offline AND pendingCount > 0
   */
  const shouldShow = forceShow || (!isOnline && pendingCount > 0);

  if (isLoading || !shouldShow) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={styles.banner}
      onPress={onPress ? handlePress : undefined}
      activeOpacity={onPress ? 0.8 : 1}
      testID="offline-indicator"
      accessibilityLabel={`Mode hors ligne. ${pendingCount} capture${pendingCount > 1 ? "s" : ""} en attente de synchronisation. Vos captures sont sauvegardées localement.`}
      accessibilityRole={onPress ? "button" : "text"}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>☁️🚫</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Mode Hors Ligne</Text>
        <Text style={styles.message}>
          {pendingCount} capture{pendingCount > 1 ? "s" : ""} en attente de
          synchronisation
        </Text>
        <Text style={styles.reassurance}>
          ✓ Vos captures sont sauvegardées localement
        </Text>
      </View>

      {onPress && (
        <View style={styles.chevronContainer}>
          <Text style={styles.chevron}>›</Text>
        </View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF9500", // Orange for warning
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  message: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  reassurance: {
    fontSize: 11,
    fontWeight: "500",
    color: "#FFFFFF",
    opacity: 0.9,
  },
  chevronContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  chevron: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
