import { defineConfig } from 'vite';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import vue from '@vitejs/plugin-vue';

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
          // Vue 3 vendor
          'vendor-vue': ['vue'],
          // Shared utilities go to a separate chunk
          'vendor-utils': ['./date-utils.ts', './string-utils.ts', './state-manager.ts', './monitoring.ts', './api-service.ts'],
          // Customer page specific (Vue 3)
          'customer': ['./app.ts', './src/customer.ts', './src/composables/useAppointment.ts'],
          // Admin page specific (Vue 3)
          'admin-panel': ['./src/admin.ts', './src/composables/useAdmin.ts']
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
  plugins: [
    vue(), // Vue 3 plugin
    ...(mode === 'analyze' ? [
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true
      })
    ] : [])
  ],

  // Resolve configuration
  resolve: {
    extensions: ['.ts', '.js', '.vue', '.json'],
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
}));
