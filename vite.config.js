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
        // Optimize chunk splitting
        manualChunks: {
          // Shared utilities go to a separate chunk
          'vendor-utils': ['./date-utils.js', './string-utils.js', './state-manager.js', './monitoring.js'],
          // Customer page specific
          'customer': ['./app.js', './security-helpers.js'],
          // Admin page specific (modular)
          'admin-panel': ['./admin-panel.js', './admin-auth.js', './api-service.js']
        }
      }
    },

    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      format: {
        comments: false // Remove all comments
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
  plugins: mode === 'analyze' ? [
    visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true
    })
  ] : []
}));
