import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom', // Fast, lightweight DOM for testing
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git', 'apps-script-backend.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        'apps-script-backend.js' // Backend script (different runtime)
      ],
      // Thresholds for quality gates (Phase 2: Business logic + utilities)
      // Phase 1: 30% (critical utilities)
      // Phase 2: 50% (business logic tests + date utils)
      // Future: DOM mocking required for 70%+ (app.ts, admin-panel.ts)
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 55,
        statements: 50
      }
    },
    // Mock DOM APIs
    setupFiles: [],
    // Timeout for slow tests
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  }
});
