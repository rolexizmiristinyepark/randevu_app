/**
 * MONITORING & ERROR TRACKING
 * Sentry + Web Vitals Integration
 */

import * as Sentry from '@sentry/browser';
import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from 'web-vitals';

// ==================== SENTRY SETUP ====================

/**
 * Initialize Sentry error tracking
 * Call this at app startup (before other code)
 */
export function initSentry(): void {
  // Check if Sentry should be enabled
  const isProduction = window.location.hostname !== 'localhost' &&
                       !window.location.hostname.includes('127.0.0.1');

  if (!isProduction) {
    console.info('[Monitoring] Sentry disabled (dev environment)');
    return;
  }

  // Initialize Sentry
  Sentry.init({
    // ⚠️ IMPORTANT: Replace with your actual Sentry DSN
    // Get from: https://sentry.io/settings/[organization]/projects/[project]/keys/
    dsn: 'YOUR_SENTRY_DSN_HERE',

    // Environment
    environment: isProduction ? 'production' : 'development',

    // Release tracking (optional - use git commit SHA)
    // release: 'randevu-app@' + __GIT_COMMIT__,

    // Performance monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Session replay (optional - records user sessions on error)
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true, // KVKK/GDPR: Mask all text
        blockAllMedia: true // Block images/videos
      })
    ],

    // Before send - filter/modify events
    beforeSend(event, _hint) {
      // Don't send errors from browser extensions
      if (event.exception) {
        const exception = event.exception.values?.[0];
        if (exception?.stacktrace?.frames?.some(frame =>
          frame.filename?.includes('chrome-extension://') ||
          frame.filename?.includes('moz-extension://')
        )) {
          return null; // Drop event
        }
      }

      // PII protection: Remove sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }

      return event;
    },

    // Ignore specific errors (known issues, browser quirks)
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension',
      'moz-extension',

      // Network errors (user connectivity issues)
      'NetworkError',
      'Failed to fetch',

      // ResizeObserver (benign)
      'ResizeObserver loop limit exceeded',

      // Common script loading issues
      'Script error',
      'Non-Error promise rejection'
    ]
  });

  console.info('[Monitoring] Sentry initialized');
}

// ==================== WEB VITALS TRACKING ====================

/**
 * Send Web Vitals to analytics
 * @param metric - Web Vitals metric
 */
function sendToAnalytics(metric: Metric): void {
  const { name, value, rating, delta } = metric;

  // Log to console (dev mode)
  if (window.location.hostname === 'localhost') {
    console.log(`[Web Vitals] ${name}:`, {
      value: Math.round(value),
      rating,
      delta: Math.round(delta)
    });
  }

  // Send to Sentry (performance monitoring)
  if (Sentry.isInitialized()) {
    Sentry.metrics.distribution(name, value, {
      unit: 'millisecond'
    });
  }

  // Optional: Send to Google Analytics
  if ('gtag' in window) {
    const gtag = (window as Window & { gtag: (...args: unknown[]) => void }).gtag;
    gtag('event', name, {
      event_category: 'Web Vitals',
      value: Math.round(value),
      event_label: rating,
      non_interaction: true
    });
  }
}

/**
 * Initialize Web Vitals tracking
 * Tracks Core Web Vitals (CLS, INP, LCP) + additional metrics
 */
export function initWebVitals(): void {
  // Core Web Vitals
  onCLS(sendToAnalytics);  // Cumulative Layout Shift
  onINP(sendToAnalytics);  // Interaction to Next Paint
  onLCP(sendToAnalytics);  // Largest Contentful Paint

  // Additional metrics
  onFCP(sendToAnalytics);  // First Contentful Paint
  onTTFB(sendToAnalytics); // Time to First Byte

  console.info('[Monitoring] Web Vitals tracking started');
}

// ==================== ERROR HANDLER ====================

/**
 * Global error handler - catch unhandled errors
 */
export function setupGlobalErrorHandlers(): void {
  // Unhandled errors
  window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.error);

    if (Sentry.isInitialized()) {
      Sentry.captureException(event.error, {
        contexts: {
          event: {
            type: 'error',
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      });
    }
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);

    if (Sentry.isInitialized()) {
      Sentry.captureException(event.reason, {
        contexts: {
          promise: {
            type: 'unhandledrejection'
          }
        }
      });
    }
  });

  console.info('[Monitoring] Global error handlers registered');
}

// ==================== MANUAL ERROR LOGGING ====================

/**
 * Log error to Sentry (for try/catch blocks)
 * @param error - Error object
 * @param context - Additional context
 */
export function logError(error: Error | unknown, context: Record<string, unknown> = {}): void {
  console.error('[App Error]', error, context);

  if (Sentry.isInitialized()) {
    Sentry.captureException(error, {
      extra: context
    });
  }
}

/**
 * Log message to Sentry (for non-error events)
 * @param message - Message to log
 * @param level - 'info', 'warning', 'error'
 * @param context - Additional context
 */
export function logMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context: Record<string, unknown> = {}
): void {
  console.log(`[App ${level.toUpperCase()}]`, message, context);

  if (Sentry.isInitialized()) {
    Sentry.captureMessage(message, {
      level,
      extra: context
    });
  }
}

// ==================== PERFORMANCE TRACKING ====================

/**
 * Track custom performance metric
 * @param name - Metric name
 * @param value - Metric value (ms)
 * @param _tags - Additional tags (currently unused due to Sentry API limitations)
 */
export function trackPerformance(
  name: string,
  value: number,
  _tags: Record<string, string> = {}
): void {
  if (Sentry.isInitialized()) {
    Sentry.metrics.distribution(name, value, {
      unit: 'millisecond'
    });
  }
}

/**
 * Measure function execution time
 * @param name - Operation name
 * @param fn - Function to measure
 * @returns Result of the function
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

// ==================== INITIALIZATION ====================

/**
 * Initialize all monitoring
 * Call this at app startup
 */
export function initMonitoring(): void {
  // Only initialize in browser environment
  if (typeof window === 'undefined') return;

  initSentry();
  initWebVitals();
  setupGlobalErrorHandlers();

  console.info('[Monitoring] All systems initialized');
}

// Export Sentry for manual usage
export { Sentry };
