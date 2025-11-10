import js from '@eslint/js';
import securityPlugin from 'eslint-plugin-security';

export default [
  js.configs.recommended,
  securityPlugin.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        sessionStorage: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Date: 'readonly',
        Promise: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        location: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        Element: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        btoa: 'readonly',

        // App globals (from modules)
        ApiService: 'readonly',
        DateUtils: 'readonly',
        createElement: 'readonly',

        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    },
    rules: {
      // Security rules (relaxed for admin panel)
      'security/detect-object-injection': 'off', // Too many false positives
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',

      // Code quality
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': 'off', // We have DEBUG flag
      'no-debugger': 'error',

      // Best practices
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-arrow-callback': 'warn',

      // ES6+
      'no-duplicate-imports': 'error',
      'no-useless-constructor': 'warn'
    }
  },
  {
    // Ignore patterns
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      '*.config.js',
      'apps-script-backend.js' // Google Apps Script - different environment
    ]
  }
];
