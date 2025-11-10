/**
 * MONITORING & ERROR TRACKING
 * Lightweight console-based monitoring
 * NOTE: Sentry and Web Vitals have been removed to reduce bundle size
 * If you need advanced monitoring, install @sentry/browser and web-vitals separately
 */

// ==================== CONSOLE-BASED ERROR TRACKING ====================

/**
 * Initialize monitoring (currently console-only)
 */
export function initSentry(): void {
  const isProduction = window.location.hostname !== 'localhost' &&
                       !window.location.hostname.includes('127.0.0.1');

  if (!isProduction) {
    console.info('[Monitoring] Development mode - console logging enabled');
    return;
  }

  console.info('[Monitoring] Production mode - minimal logging');
}

/**
 * Initialize Web Vitals tracking (placeholder)
 */
export function initWebVitals(): void {
  console.info('[Monitoring] Web Vitals tracking disabled (to enable: npm install web-vitals)');
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  // Unhandled errors
  window.addEventListener('error', (event) => {
    console.error('[Global Error]', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
  });

  console.info('[Monitoring] Global error handlers registered');
}

/**
 * Log error (console-only)
 */
export function logError(error: Error | unknown, context: Record<string, unknown> = {}): void {
  console.error('[App Error]', error, context);
}

/**
 * Log message (console-only)
 */
export function logMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context: Record<string, unknown> = {}
): void {
  const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
  logFn(`[App ${level.toUpperCase()}]`, message, context);
}

/**
 * Track performance metric (console-only in dev)
 */
export function trackPerformance(
  name: string,
  value: number,
  _tags: Record<string, string> = {}
): void {
  if (window.location.hostname === 'localhost') {
    console.log(`[Performance] ${name}: ${Math.round(value)}ms`);
  }
}

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;
    trackPerformance(name, duration, { status: 'success' });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    trackPerformance(name, duration, { status: 'error' });
    logError(error, { operation: name });
    throw error;
  }
}

/**
 * Initialize all monitoring
 */
export function initMonitoring(): void {
  if (typeof window === 'undefined') return;

  initSentry();
  initWebVitals();
  setupGlobalErrorHandlers();

  console.info('[Monitoring] Lightweight monitoring initialized');
}

// Placeholder Sentry export for compatibility
export const Sentry = {
  captureException: (error: unknown, _options?: unknown) => {
    console.error('[Sentry Placeholder]', error);
  },
  captureMessage: (message: string, _options?: unknown) => {
    console.log('[Sentry Placeholder]', message);
  },
  isInitialized: () => false
};
