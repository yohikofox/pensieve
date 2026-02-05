/**
 * Network Status Service
 * Story 4.4: Notifications de Progression IA
 * Task 10, Subtask 10.1: Detect network status changes (NetInfo)
 *
 * AC8: Offline Queue Notification
 * - Detect when network goes offline/online
 * - Emit events for network status changes
 * - Support subscriptions for real-time updates
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  type: NetInfoStateType;
  timestamp: Date;
}

export type NetworkStatusCallback = (status: NetworkStatus) => void;

/**
 * NetworkStatusService
 *
 * Monitors network connectivity changes using NetInfo
 * Provides subscription mechanism for real-time updates
 *
 * Usage:
 * ```typescript
 * const service = NetworkStatusService.getInstance();
 * const unsubscribe = service.subscribe((status) => {
 *   console.log('Network status:', status.isConnected);
 * });
 *
 * // Later:
 * unsubscribe();
 * ```
 */
export class NetworkStatusService {
  private static instance: NetworkStatusService;
  private currentStatus: NetworkStatus | null = null;
  private subscribers: Set<NetworkStatusCallback> = new Set();
  private unsubscribeNetInfo?: (() => void) | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): NetworkStatusService {
    if (!NetworkStatusService.instance) {
      NetworkStatusService.instance = new NetworkStatusService();
    }
    return NetworkStatusService.instance;
  }

  /**
   * Initialize network monitoring
   * Should be called once on app startup
   */
  public async initialize(): Promise<void> {
    // Get initial network state
    const initialState = await NetInfo.fetch();
    this.currentStatus = this.mapNetInfoState(initialState);

    // Subscribe to network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const newStatus = this.mapNetInfoState(state);

      // Only notify if connectivity actually changed
      const connectivityChanged =
        !this.currentStatus || this.currentStatus.isConnected !== newStatus.isConnected;

      this.currentStatus = newStatus;

      if (connectivityChanged) {
        this.notifySubscribers(newStatus);
      }
    });
  }

  /**
   * Clean up resources
   * Call on app shutdown or service disposal
   */
  public dispose(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.subscribers.clear();
    this.currentStatus = null;
  }

  /**
   * Get current network status
   * Returns null if not initialized
   */
  public getCurrentStatus(): NetworkStatus | null {
    return this.currentStatus;
  }

  /**
   * Subscribe to network status changes
   * Returns unsubscribe function
   */
  public subscribe(callback: NetworkStatusCallback): () => void {
    this.subscribers.add(callback);

    // Immediately notify with current status if available
    if (this.currentStatus) {
      callback(this.currentStatus);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Map NetInfo state to our NetworkStatus format
   */
  private mapNetInfoState(state: NetInfoState): NetworkStatus {
    return {
      isConnected: state.isConnected ?? false,
      type: state.type,
      timestamp: new Date(),
    };
  }

  /**
   * Notify all subscribers of network status change
   */
  private notifySubscribers(status: NetworkStatus): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error('[NetworkStatusService] Error in subscriber callback:', error);
      }
    });
  }

  /**
   * Check if currently online
   * Convenience method for quick checks
   */
  public isOnline(): boolean {
    return this.currentStatus?.isConnected ?? false;
  }

  /**
   * Check if currently offline
   * Convenience method for quick checks
   */
  public isOffline(): boolean {
    return !this.isOnline();
  }
}
