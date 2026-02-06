/**
 * Logger Interface
 *
 * Production-ready logging interface with environment-aware log levels.
 * Supports dependency injection for better testability.
 *
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

export type LogFunction = (...args: any[]) => void;

/**
 * Logger Interface
 *
 * In development (__DEV__):
 * - All logs are enabled (debug, info, warn, error)
 *
 * In production:
 * - Only warn and error are enabled
 * - debug and info are no-ops
 */
export interface ILogger {
  /**
   * Debug logs - Development only
   * Use for detailed debugging information
   */
  debug: LogFunction;

  /**
   * Info logs - Development only
   * Use for general informational messages
   */
  info: LogFunction;

  /**
   * Warning logs - Always shown
   * Use for non-critical issues that should be investigated
   */
  warn: LogFunction;

  /**
   * Error logs - Always shown
   * Use for errors and exceptions
   */
  error: LogFunction;

  /**
   * Create a scoped logger with a prefix
   *
   * @param scope - Scope prefix (e.g., 'App', 'Service')
   * @returns Logger with scoped prefix
   *
   * @example
   * const scopedLog = logger.createScope('MyService');
   * scopedLog.debug('Starting...'); // Output: [MyService] Starting...
   */
  createScope(scope: string): ILogger;
}
