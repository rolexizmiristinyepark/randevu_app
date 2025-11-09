import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'happy-dom', // Daha hızlı alternatif: 'jsdom'

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.js',
        '**/*.test.js',
        '**/*.spec.js',
        'tests/',
        'apps-script-backend.js' // Backend GAS ortamında çalışır
      ],
      // Minimum coverage thresholds
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60
    },

    // Global test setup
    globals: true,

    // Test file patterns
    include: [
      '**/*.{test,spec}.{js,mjs,cjs}',
      'tests/**/*.{test,spec}.{js,mjs,cjs}'
    ],

    // Test timeouts
    testTimeout: 10000, // 10 saniye
    hookTimeout: 10000,

    // Concurrent tests
    sequence: {
      concurrent: true
    },

    // Reporter
    reporters: ['verbose'],

    // Mock
    mockReset: true,
    restoreMocks: true,

    // UI (opsiyonel - vitest --ui)
    ui: true,
    open: false
  },

  // Resolve aliases (import paths)
  resolve: {
    alias: {
      '@': resolve(__dirname, './')
    }
  }
});
