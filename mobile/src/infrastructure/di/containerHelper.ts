/**
 * Container Helper - Centralized dependency resolution utilities
 * Provides safe methods to resolve dependencies from the DI container
 */
import { container } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';

/**
 * Resolves a required dependency from the container
 * Throws if the dependency is not registered
 */
export function resolve<T>(token: InjectionToken<T>): T {
  return container.resolve(token);
}

/**
 * Resolves an optional dependency from the container
 * Returns null if the dependency is not registered
 */
export function resolveOptional<T>(token: InjectionToken<T>): T | null {
  try {
    return container.resolve(token);
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a dependency is registered in the container
 */
export function isRegistered<T>(token: InjectionToken<T>): boolean {
  try {
    container.resolve(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a dependency with a fallback value
 */
export function resolveWithFallback<T>(token: InjectionToken<T>, fallback: T): T {
  return resolveOptional(token) ?? fallback;
}

/**
 * Helper object for convenient access
 */
export const DI = {
  resolve,
  resolveOptional,
  isRegistered,
  resolveWithFallback,
} as const;
