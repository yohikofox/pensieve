/**
 * useUserFeatures Hook
 * Story 7.1: Support Mode avec Permissions Backend
 *
 * React Query hook for fetching and caching user feature flags
 * AC3: Fetch at startup
 * AC5: Manual refresh via pull-to-refresh
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { UserFeaturesService } from '../services/user-features.service';
import type { UserFeatures } from '../domain/user-features.model';

const QUERY_KEY = ['userFeatures'] as const;

/**
 * Lazy resolution of UserFeaturesService from DI container
 * CRITICAL: Must be inside hook, not module-level
 */
function getUserFeaturesService(): UserFeaturesService {
  return container.resolve(UserFeaturesService);
}

interface UseUserFeaturesOptions {
  /**
   * User ID to fetch features for
   * Should come from auth context
   */
  userId: string | null;

  /**
   * Enable the query (default: true when userId exists)
   */
  enabled?: boolean;
}

/**
 * Hook to fetch and cache user feature flags
 * Uses React Query for automatic caching and refetching
 *
 * @param options - Hook options with userId
 * @returns React Query result with user features
 *
 * @example
 * ```tsx
 * const { data: features, refetch } = useUserFeatures({ userId: user.id });
 *
 * if (features?.debug_mode_access) {
 *   // Show debug mode toggle in settings
 * }
 * ```
 */
export function useUserFeatures(options: UseUserFeaturesOptions) {
  const { userId, enabled = true } = options;

  return useQuery({
    queryKey: [...QUERY_KEY, userId],
    queryFn: async (): Promise<UserFeatures> => {
      if (!userId) {
        throw new Error('User ID is required to fetch features');
      }

      const service = getUserFeaturesService();
      const result = await service.getUserFeatures(userId);

      if (!result.success) {
        throw result.error;
      }

      return result.data;
    },
    enabled: enabled && userId !== null,
    staleTime: 60 * 60 * 1000, // 1 hour - features don't change often
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in cache
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to manually refresh user features
 * AC5: Refresh from profile/settings (pull-to-refresh)
 *
 * @returns Function to refresh user features
 *
 * @example
 * ```tsx
 * const refreshFeatures = useRefreshUserFeatures();
 *
 * const onRefresh = async () => {
 *   await refreshFeatures('user-id');
 * };
 * ```
 */
export function useRefreshUserFeatures() {
  const queryClient = useQueryClient();

  return async (userId: string) => {
    const service = getUserFeaturesService();
    const result = await service.refreshUserFeatures(userId);

    if (result.success) {
      // Update React Query cache
      queryClient.setQueryData([...QUERY_KEY, userId], result.data);
      return result.data;
    }

    throw result.error;
  };
}
