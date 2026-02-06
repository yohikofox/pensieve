/**
 * Custom Logger
 *
 * Production-ready logging utility that:
 * - Shows only errors and warnings in production
 * - Shows all logs in development
 * - Can be easily extended with features (timestamps, remote logging, etc.)
 *
 * Usage:
 * ```typescript
 * import logger from '@/utils/logger';
 *
 * logger.debug('Debug info');     // Only in dev
 * logger.info('Info message');    // Only in dev
 * logger.warn('Warning');         // Always
 * logger.error('Error', error);   // Always
 * ```
 */

type LogFunction = (...args: any[]) => void;

interface Logger {
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
}

/**
 * Create a no-op function for disabled logs
 */
const noop: LogFunction = () => {};

/**
 * Logger instance
 *
 * In development (__DEV__):
 * - All logs are enabled (debug, info, warn, error)
 *
 * In production:
 * - Only warn and error are enabled
 * - debug and info are no-ops (stripped out)
 */
const logger: Logger = {
  debug: __DEV__ ? console.debug.bind(console) : noop,
  info: __DEV__ ? console.info.bind(console) : noop,
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export default logger;

/**
 * Optional: Create a scoped logger with a prefix
 *
 * @param scope - Scope prefix (e.g., 'App', 'Service')
 * @returns Logger with scoped prefix
 *
 * @example
 * const log = createLogger('MyService');
 * log.debug('Starting...'); // Output: [MyService] Starting...
 */
export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;

  return {
    debug: __DEV__ ? console.debug.bind(console, prefix) : noop,
    info: __DEV__ ? console.info.bind(console, prefix) : noop,
    warn: console.warn.bind(console, prefix),
    error: console.error.bind(console, prefix),
  };
}
