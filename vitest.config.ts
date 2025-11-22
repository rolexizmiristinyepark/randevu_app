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
      // Thresholds for quality gates (Phase 3: DOM mocking + comprehensive coverage)
      // Phase 1: 30% (critical utilities)
      // Phase 2: 50% (business logic tests + date utils)
      // Phase 3: 75% (DOM functions + monitoring + config-loader) ✅ ACHIEVED: 77.39%
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 85,
        statements: 75
      }
    },
    // Mock DOM APIs (Phase 3: DOM mocking infrastructure)
    setupFiles: ['./tests/setup.ts'],
    // Timeout for slow tests
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  }
});
