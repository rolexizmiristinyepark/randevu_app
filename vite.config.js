import { defineConfig } from 'vite';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  // GitHub Pages base path
  base: '/randevu_app/',

  // Multi-page app configuration
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      },
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Base layer - shared infrastructure (tree-shakeable)
          'base-layer': [
            './StateManager.ts',
            './CacheManager.ts',
            './UIManager.ts'
          ],
          // Utilities - small, frequently changing
          'utils': [
            './date-utils.ts',
            './time-utils.ts',
            './string-utils.ts',
            './validation-utils.ts',
            './error-utils.ts',
            './button-utils.ts'
          ],
          // Security - critical, rarely changing
          'security': [
            './security-helpers.ts'
          ],
          // API - shared between main and admin
          'api': [
            './api-service.ts',
            './config-loader.ts'
          ],
          // Flow components - appointment booking flow
          'flow-components': [
            './TypeSelectorComponent.ts',
            './CalendarComponent.ts',
            './StaffSelectorComponent.ts',
            './TimeSelectorComponent.ts'
          ]
          // Note: calendar-integration is already lazy loaded via dynamic import
        }
      }
    },

    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2, // ✅ Extra minification pass (marginal benefit)
        unsafe_arrows: true, // ✅ Convert arrow functions to shorter syntax
        unsafe_methods: true // ✅ Optimize method calls
      },
      format: {
        comments: false // Remove all comments
      },
      mangle: {
        safari10: true // ✅ Better Safari compatibility
      }
    },

    // Output directory
    outDir: 'dist',

    // Asset handling
    assetsDir: 'assets',

    // Generate sourcemaps for debugging (optional)
    sourcemap: false,

    // Target modern browsers for smaller bundle size
    target: 'es2020',

    // CSS code splitting
    cssCodeSplit: true,

    // Chunk size warnings
    chunkSizeWarningLimit: 500
  },

  // Server configuration for development
  server: {
    port: 3000,
    open: true,
    cors: true
  },

  // Preview server configuration
  preview: {
    port: 4173,
    open: true
  },

  // Plugin configuration
  plugins: [
    ...(mode === 'analyze' ? [
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true
      })
    ] : [])
  ]
}));
