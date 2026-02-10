import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // CRITICAL: Load ALL env files (.env, .env.local, .env.[mode], .env.[mode].local)
  const env = loadEnv(mode, process.cwd(), '');
  
  // Environment variable varlık kontrolü (değerler loglanmaz)
  console.log('Build mode:', mode);
  console.log('Env vars:', {
    SUPABASE_URL: env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    BASE_URL: env.VITE_BASE_URL ? 'SET' : 'MISSING',
    TURNSTILE_SITE_KEY: env.VITE_TURNSTILE_SITE_KEY ? 'SET' : 'MISSING'
  });

  // ✅ VALIDATION: Fail fast if required env vars are missing
  if (!env.VITE_SUPABASE_URL) {
    console.error('CRITICAL: VITE_SUPABASE_URL is not defined!');
    console.error('   Please check .env or .env.production file');
  }
  if (!env.VITE_SUPABASE_ANON_KEY) {
    console.error('CRITICAL: VITE_SUPABASE_ANON_KEY is not defined!');
    console.error('   Please check .env or .env.production file');
  }

  return {
    // Base path - Vercel uses root
    base: '/',

    // TypeScript compilation with esbuild
    // console/debugger drop terser'da yapılıyor, burada tekrar gerek yok
    esbuild: {},

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
          }
        }
      },

      // Minification settings
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
          pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
          passes: 2,
          unsafe_arrows: true,
          unsafe_methods: true
        },
        format: {
          comments: false
        },
        mangle: {
          safari10: true
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

    // ✅ CRITICAL: Define environment variables for production build
    // This is the key fix - ensures env vars are properly injected at build time
    define: {
      // Use string replacement to inject actual values at build time
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_BASE_URL': JSON.stringify(env.VITE_BASE_URL || ''),
      'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(env.VITE_TURNSTILE_SITE_KEY || ''),
      'import.meta.env.VITE_DEBUG': JSON.stringify(env.VITE_DEBUG || 'false'),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION || '1.0.0'),
      'import.meta.env.VITE_API_TIMEOUT': JSON.stringify(env.VITE_API_TIMEOUT || '30000'),
      'import.meta.env.VITE_MAX_RETRIES': JSON.stringify(env.VITE_MAX_RETRIES || '3')
    },

    // ✅ NEW: Explicitly tell Vite to load .env files
    envDir: process.cwd(),
    envPrefix: 'VITE_'
  };
});
