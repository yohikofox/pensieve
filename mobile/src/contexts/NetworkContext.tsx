/**
 * NetworkContext - Network Status Provider
 *
 * Story 3.1 - AC3: Offline Feed Access
 *
 * Provides real-time network connectivity status via React Context.
 * Uses @react-native-community/netinfo for native network monitoring.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextValue {
  isConnected: boolean;
  isOffline: boolean;
  connectionType: string | null;
}

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
  isOffline: false,
  connectionType: null,
});

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [networkState, setNetworkState] = useState<NetworkContextValue>({
    isConnected: true,
    isOffline: false,
    connectionType: null,
  });

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? true;
      setNetworkState({
        isConnected,
        isOffline: !isConnected,
        connectionType: state.type,
      });
    });

    // Fetch initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      const isConnected = state.isConnected ?? true;
      setNetworkState({
        isConnected,
        isOffline: !isConnected,
        connectionType: state.type,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus(): NetworkContextValue {
  return useContext(NetworkContext);
}

export { NetworkContext };
