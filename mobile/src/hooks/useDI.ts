/**
 * React hooks for Dependency Injection
 * Provides idiomatic React access to DI container
 */
import { useMemo } from 'react';
import type { InjectionToken } from 'tsyringe';
import { DI } from '../infrastructure/di/containerHelper';

/**
 * Hook to resolve a required dependency from the DI container
 * Throws if the dependency is not registered
 *
 * @example
 * const repository = useDI<ICaptureRepository>(TOKENS.ICaptureRepository);
 */
export function useDI<T>(token: InjectionToken<T>): T {
  return useMemo(() => DI.resolve(token), [token]);
}

/**
 * Hook to resolve an optional dependency from the DI container
 * Returns null if the dependency is not registered
 *
 * @example
 * const syncService = useOptionalDI<ISyncService>(TOKENS.ISyncService);
 *
 * if (syncService) {
 *   await syncService.syncCaptures();
 * }
 */
export function useOptionalDI<T>(token: InjectionToken<T>): T | null {
  return useMemo(() => DI.resolveOptional(token), [token]);
}

/**
 * Hook to check if a dependency is registered in the DI container
 *
 * @example
 * const hasSyncService = useIsDIRegistered(TOKENS.ISyncService);
 */
export function useIsDIRegistered<T>(token: InjectionToken<T>): boolean {
  return useMemo(() => DI.isRegistered(token), [token]);
}

/**
 * Hook to resolve a dependency with a fallback value
 *
 * @example
 * const config = useDIWithFallback(TOKENS.IAppConfig, defaultConfig);
 */
export function useDIWithFallback<T>(token: InjectionToken<T>, fallback: T): T {
  return useMemo(() => DI.resolveWithFallback(token, fallback), [token, fallback]);
}
