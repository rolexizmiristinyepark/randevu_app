// ESLint v9+ Flat Config
import js from '@eslint/js';
import securityPlugin from 'eslint-plugin-security';

export default [
  // Frontend JavaScript files (TypeScript checked by tsc)
  {
    files: ['**/*.js'],
    ignores: ['apps-script-backend.js', 'measurement-script.js', 'dist/**', 'node_modules/**'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        sessionStorage: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        globalThis: 'readonly',
        location: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',

        // DOM functions
        createElement: 'readonly',

        // App-specific globals (from other modules)
        ApiService: 'readonly',
        DateUtils: 'readonly',
        apiCall: 'readonly',
        apiCallWithKey: 'readonly'
      }
    },
    plugins: {
      security: securityPlugin
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
      'security/detect-object-injection': 'off', // Too many false positives
      'security/detect-non-literal-regexp': 'warn'
    }
  },

  // Node.js configuration files
  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        console: 'readonly'
      }
    }
  },

  // Google Apps Script backend (special config)
  {
    files: ['apps-script-backend.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script', // Apps Script uses global scope
      globals: {
        // Google Apps Script global services
        Logger: 'readonly',
        PropertiesService: 'readonly',
        CalendarApp: 'readonly',
        UrlFetchApp: 'readonly',
        ContentService: 'readonly',
        GmailApp: 'readonly',
        LockService: 'readonly',
        CacheService: 'readonly',
        Utilities: 'readonly',
        Session: 'readonly',
        HtmlService: 'readonly',
        MailApp: 'readonly',

        // JavaScript built-ins
        console: 'readonly',
        JSON: 'readonly',
        Date: 'readonly',
        Math: 'readonly',

        // Our global constants (will be defined)
        DEBUG: 'writable',
        log: 'writable',
        ADMIN_ACTIONS: 'writable',
        ACTION_HANDLERS: 'writable',
        CONFIG: 'writable',
        ICS_TEMPLATES: 'writable',

        // Services (will be created during refactor)
        SecurityService: 'writable',
        LockServiceWrapper: 'writable',
        DateUtils: 'writable',
        Utils: 'writable',
        StorageService: 'writable',
        AuthService: 'writable',
        CacheServiceWrapper: 'writable',
        StaffService: 'writable',
        SettingsService: 'writable',
        ConfigService: 'writable',
        ShiftService: 'writable',
        AppointmentService: 'writable',
        VersionService: 'writable',
        SlotService: 'writable',
        ValidationService: 'writable',
        AvailabilityService: 'writable',
        CalendarService: 'writable',
        NotificationService: 'writable',
        WhatsAppService: 'writable',
        SlackService: 'writable',

        // Helper functions
        loadExternalConfigs: 'writable',
        loadWhatsAppConfig: 'writable',
        createManualAppointment: 'writable',
        getManagementSlotAvailability: 'writable'
      }
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(doGet|doPost|sendDailyWhatsAppReminders|sendDailySlackReminders|testSlackIntegration|testWhatsAppMessage|OLD_.*)$'
      }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'error'
    }
  }
];
