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
      // Thresholds for quality gates (Phase 1: Critical utilities)
      // Will increase to 70%+ as we add more tests in Phase 2-3
      thresholds: {
        lines: 30,
        functions: 40,
        branches: 40,
        statements: 30
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
