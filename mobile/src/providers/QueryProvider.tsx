/**
 * React Query Provider Configuration
 *
 * Story 5.1 - Task 2: Configure React Query for data fetching and caching
 * Provides QueryClient to the entire app for cache management
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Create QueryClient with default options
 * Subtask 2.4: staleTime 5 minutes for todos
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      staleTime: 0, // Data is stale immediately (per-query override)
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on window focus (mobile app)
      refetchOnReconnect: true, // Refetch on network reconnect
    },
    mutations: {
      retry: 1, // Retry failed mutations once
      retryDelay: 1000, // 1 second delay before retry
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * React Query Provider
 * Wrap app with this provider to enable React Query hooks
 */
export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

/**
 * Export queryClient for direct access if needed
 * (e.g., for invalidation outside React components)
 */
export { queryClient };
