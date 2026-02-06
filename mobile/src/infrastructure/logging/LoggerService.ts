/**
 * Logger Service Implementation
 *
 * Production-ready logging service that:
 * - Shows only errors and warnings in production
 * - Shows all logs in development
 * - Supports scoped loggers with prefixes
 * - Can be easily extended with features (timestamps, remote logging, etc.)
 *
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import type { ILogger, LogFunction } from './ILogger';

/**
 * Create a no-op function for disabled logs
 */
const noop: LogFunction = () => {};

/**
 * Logger Service
 *
 * Default implementation that uses console.* methods.
 * In production, debug/info are stripped out.
 */
@injectable()
export class LoggerService implements ILogger {
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;

  constructor() {
    this.debug = __DEV__ ? console.debug.bind(console) : noop;
    this.info = __DEV__ ? console.info.bind(console) : noop;
    this.warn = console.warn.bind(console);
    this.error = console.error.bind(console);
  }

  /**
   * Create a scoped logger with a prefix
   *
   * @param scope - Scope prefix (e.g., 'App', 'Service')
   * @returns Logger with scoped prefix
   *
   * @example
   * const log = logger.createScope('MyService');
   * log.debug('Starting...'); // Output: [MyService] Starting...
   */
  createScope(scope: string): ILogger {
    const prefix = `[${scope}]`;

    return {
      debug: __DEV__ ? console.debug.bind(console, prefix) : noop,
      info: __DEV__ ? console.info.bind(console, prefix) : noop,
      warn: console.warn.bind(console, prefix),
      error: console.error.bind(console, prefix),
      createScope: (childScope: string) => {
        return this.createScope(`${scope}:${childScope}`);
      },
    };
  }
}
