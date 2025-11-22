import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initSentry,
  initWebVitals,
  setupGlobalErrorHandlers,
  logError,
  logMessage,
  trackPerformance,
  measureAsync
} from '../monitoring';

describe('Monitoring & Error Tracking', () => {
  let consoleInfoSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    // Spy on console methods
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset window.location for each test
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        hostname: 'localhost',
        href: 'http://localhost:3000'
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initSentry', () => {
    it('should log development mode on localhost', () => {
      window.location.hostname = 'localhost';

      initSentry();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Monitoring] Development mode - console logging enabled'
      );
    });

    it('should log development mode on 127.0.0.1', () => {
      window.location.hostname = '127.0.0.1';

      initSentry();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Monitoring] Development mode - console logging enabled'
      );
    });

    it('should log production mode on production domain', () => {
      window.location.hostname = 'rolexizmiristinyepark.github.io';

      initSentry();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Monitoring] Production mode - minimal logging'
      );
    });

    it('should detect production correctly', () => {
      const productionDomains = [
        'example.com',
        'app.example.com',
        'rolexizmiristinyepark.github.io'
      ];

      productionDomains.forEach(domain => {
        vi.clearAllMocks();
        window.location.hostname = domain;

        initSentry();

        expect(consoleInfoSpy).toHaveBeenCalledWith(
          '[Monitoring] Production mode - minimal logging'
        );
      });
    });
  });

  describe('initWebVitals', () => {
    it('should log that Web Vitals tracking is disabled', () => {
      initWebVitals();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Monitoring] Web Vitals tracking disabled (to enable: npm install web-vitals)'
      );
    });

    it('should provide installation instructions', () => {
      initWebVitals();

      const message = consoleInfoSpy.mock.calls[0][0];
      expect(message).toContain('npm install web-vitals');
    });
  });

  describe('setupGlobalErrorHandlers', () => {
    it('should register global error handler', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      setupGlobalErrorHandlers();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      );
    });

    it('should log confirmation message', () => {
      setupGlobalErrorHandlers();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Monitoring] Global error handlers registered'
      );
    });

    it('should handle error events', () => {
      setupGlobalErrorHandlers();

      // Trigger error event
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Test error')
      });

      window.dispatchEvent(errorEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Global Error]',
        expect.objectContaining({
          message: 'Test error',
          filename: 'test.js',
          lineno: 10,
          colno: 5
        })
      );
    });

    it.skip('should handle unhandled promise rejections', () => {
      // Skipped: PromiseRejectionEvent not available in happy-dom
      // Tested in integration tests
      setupGlobalErrorHandlers();

      // Trigger unhandled rejection event
      // const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
      //   promise: Promise.reject('Test rejection'),
      //   reason: 'Test rejection'
      // });

      // window.dispatchEvent(rejectionEvent);

      // expect(consoleErrorSpy).toHaveBeenCalledWith(
      //   '[Unhandled Promise Rejection]',
      //   'Test rejection'
      // );
    });
  });

  describe('logError', () => {
    it('should log error to console', () => {
      const error = new Error('Test error');

      logError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[App Error]',
        error,
        {}
      );
    });

    it('should log error with context', () => {
      const error = new Error('API failed');
      const context = { endpoint: '/api/appointments', status: 500 };

      logError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[App Error]',
        error,
        context
      );
    });

    it('should handle non-Error objects', () => {
      const errorString = 'Something went wrong';

      logError(errorString);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[App Error]',
        errorString,
        {}
      );
    });

    it('should handle null/undefined errors', () => {
      logError(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[App Error]', null, {});

      logError(undefined);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[App Error]', undefined, {});
    });
  });

  describe('logMessage', () => {
    it('should log info message by default', () => {
      logMessage('Test info message');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[App INFO]',
        'Test info message',
        {}
      );
    });

    it('should log warning message', () => {
      logMessage('Test warning', 'warning');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[App WARNING]',
        'Test warning',
        {}
      );
    });

    it('should log error message', () => {
      logMessage('Test error', 'error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[App ERROR]',
        'Test error',
        {}
      );
    });

    it('should log message with context', () => {
      const context = { userId: '123', action: 'login' };

      logMessage('User action', 'info', context);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[App INFO]',
        'User action',
        context
      );
    });

    it('should uppercase log level', () => {
      logMessage('Test', 'warning');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[App WARNING]',
        'Test',
        {}
      );
    });
  });

  describe('trackPerformance', () => {
    it('should log performance in localhost', () => {
      window.location.hostname = 'localhost';

      trackPerformance('API Call', 250.5);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Performance] API Call: 251ms'
      );
    });

    it('should round performance values', () => {
      window.location.hostname = 'localhost';

      trackPerformance('Test', 123.789);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Performance] Test: 124ms'
      );
    });

    it('should not log performance in production', () => {
      window.location.hostname = 'example.com';

      trackPerformance('API Call', 250);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should accept tags parameter (ignored in console version)', () => {
      window.location.hostname = 'localhost';

      trackPerformance('Test', 100, { endpoint: '/api/test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Performance] Test: 100ms'
      );
    });

    it('should handle zero duration', () => {
      window.location.hostname = 'localhost';

      trackPerformance('Instant', 0);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Performance] Instant: 0ms'
      );
    });

    it('should handle large values', () => {
      window.location.hostname = 'localhost';

      trackPerformance('Slow operation', 5432.1);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Performance] Slow operation: 5432ms'
      );
    });
  });

  describe('measureAsync', () => {
    beforeEach(() => {
      // Mock performance.now
      let time = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        const current = time;
        time += 100; // Each call adds 100ms
        return current;
      });

      window.location.hostname = 'localhost';
    });

    it('should measure async function execution time', async () => {
      const testFn = async () => {
        return 'result';
      };

      const result = await measureAsync('Test operation', testFn);

      expect(result).toBe('result');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Performance] Test operation: 100ms'
      );
    });

    it('should return function result', async () => {
      const testFn = async () => {
        return { data: 'test data' };
      };

      const result = await measureAsync('Fetch data', testFn);

      expect(result).toEqual({ data: 'test data' });
    });

    it('should track successful operations', async () => {
      const testFn = async () => 'success';

      await measureAsync('Operation', testFn);

      // Function called performance.now() twice (start and end)
      expect(performance.now).toHaveBeenCalledTimes(2);
    });

    it('should track failed operations and re-throw error', async () => {
      const testFn = async () => {
        throw new Error('Operation failed');
      };

      await expect(
        measureAsync('Failing operation', testFn)
      ).rejects.toThrow('Operation failed');

      // Should still log performance (even for failures)
      expect(performance.now).toHaveBeenCalledTimes(2);
    });

    it('should measure nested async calls', async () => {
      const innerFn = async () => 'inner';
      const outerFn = async () => {
        const inner = await measureAsync('Inner', innerFn);
        return `outer-${inner}`;
      };

      const result = await measureAsync('Outer', outerFn);

      expect(result).toBe('outer-inner');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);

      // Check first call (Inner)
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        '[Performance] Inner: 100ms'
      );

      // Outer includes time for inner call, so it's longer
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('[Performance] Outer:')
      );
    });

    it('should handle async functions that return undefined', async () => {
      const testFn = async () => {
        // No return value
      };

      const result = await measureAsync('Void operation', testFn);

      expect(result).toBeUndefined();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle Promise-based functions', async () => {
      const testFn = () => Promise.resolve('promise result');

      const result = await measureAsync('Promise op', testFn);

      expect(result).toBe('promise result');
    });
  });

  describe('Production vs Development Mode', () => {
    it('should have different behavior on localhost', () => {
      window.location.hostname = 'localhost';

      initSentry();
      trackPerformance('Test', 100);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Monitoring] Development mode - console logging enabled'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Performance] Test: 100ms'
      );
    });

    it('should have different behavior in production', () => {
      window.location.hostname = 'production.example.com';

      initSentry();
      trackPerformance('Test', 100);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Monitoring] Production mode - minimal logging'
      );
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Context Tracking', () => {
    it('should preserve error context in logs', () => {
      const error = new Error('Database connection failed');
      const context = {
        database: 'postgres',
        host: 'localhost',
        retries: 3
      };

      logError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[App Error]',
        error,
        context
      );
    });

    it('should handle nested context objects', () => {
      const context = {
        user: {
          id: '123',
          email: 'test@example.com'
        },
        request: {
          method: 'POST',
          url: '/api/appointments'
        }
      };

      logMessage('API request failed', 'error', context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[App ERROR]',
        'API request failed',
        context
      );
    });
  });
});
