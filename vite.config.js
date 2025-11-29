import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
  // GitHub Pages base path
  base: '/randevu_app/',

  // TypeScript compilation with esbuild
  esbuild: {
    drop: ['console', 'debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.warn']
  },

  // Multi-page app configuration
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        kvkk: resolve(__dirname, 'kvkk-aydinlatma.html')
      },
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Base layer - shared infrastructure (tree-shakeable)
          'base-layer': [
            './CacheManager.ts',
            './UIManager.ts',
            './StateManager.ts'
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
          ],
          // Form and success components
          'form-success': [
            './AppointmentFormComponent.ts',
            './SuccessPageComponent.ts'
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
  ],

  // Define environment variables for production build
  // This ensures env vars are properly injected even when .env.production isn't auto-loaded
  define: {
    'import.meta.env.VITE_APPS_SCRIPT_URL': JSON.stringify(env.VITE_APPS_SCRIPT_URL),
    'import.meta.env.VITE_BASE_URL': JSON.stringify(env.VITE_BASE_URL),
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(env.VITE_TURNSTILE_SITE_KEY),
    'import.meta.env.VITE_DEBUG': JSON.stringify(env.VITE_DEBUG),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION || '1.0.0')
  }
};
});
