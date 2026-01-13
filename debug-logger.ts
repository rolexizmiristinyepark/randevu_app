/**
 * Centralized Debug Logger
 *
 * A debug-aware logging utility that only outputs when CONFIG.DEBUG is true.
 * Use this instead of duplicating the debug pattern in each component.
 *
 * @example
 * import { createDebugLogger } from './debug-logger';
 * const debug = createDebugLogger('MyComponent');
 * debug.log('Something happened'); // Only logs if DEBUG=true
 */

type LogLevel = 'error' | 'warn' | 'info' | 'log';

interface DebugLogger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
}

/**
 * Check if debug mode is enabled
 */
function isDebugEnabled(): boolean {
  return typeof window !== 'undefined' && window.CONFIG?.DEBUG === true;
}

/**
 * Create a debug logger with optional prefix
 *
 * @param prefix - Optional prefix for log messages (e.g., component name)
 * @returns Debug logger object with error, warn, info, log methods
 */
export function createDebugLogger(prefix?: string): DebugLogger {
  const formatArgs = (args: unknown[]): unknown[] => {
    if (prefix) {
      return [`[${prefix}]`, ...args];
    }
    return args;
  };

  return {
    error: (...args: unknown[]) => {
      if (isDebugEnabled()) {
        console.error(...formatArgs(args));
      }
    },
    warn: (...args: unknown[]) => {
      if (isDebugEnabled()) {
        console.warn(...formatArgs(args));
      }
    },
    info: (...args: unknown[]) => {
      if (isDebugEnabled()) {
        console.info(...formatArgs(args));
      }
    },
    log: (...args: unknown[]) => {
      if (isDebugEnabled()) {
        console.log(...formatArgs(args));
      }
    }
  };
}

/**
 * Default debug logger (no prefix)
 * Can be used when a simple debug logger is needed without creating a new instance
 */
export const debug = createDebugLogger();

/**
 * Conditional debug execution
 * Runs the callback only if debug mode is enabled
 *
 * @param callback - Function to execute in debug mode
 */
export function debugOnly(callback: () => void): void {
  if (isDebugEnabled()) {
    callback();
  }
}

// Export for window global (backward compatibility)
if (typeof window !== 'undefined') {
  (window as { createDebugLogger?: typeof createDebugLogger }).createDebugLogger = createDebugLogger;
}
