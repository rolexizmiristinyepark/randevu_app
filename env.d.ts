/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPS_SCRIPT_URL: string;
  readonly VITE_BASE_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
  readonly VITE_DEBUG: string;
  readonly VITE_ENABLE_ANALYTICS: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_MAX_RETRIES: string;
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
