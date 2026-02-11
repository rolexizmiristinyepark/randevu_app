/**
 * CONFIG LOADER - Supabase Edition
 *
 * Architecture:
 * - Environment config (SUPABASE_URL, SUPABASE_ANON_KEY, BASE_URL): From .env files (build-time)
 * - Business config (shifts, hours, limits): Loaded from Supabase Edge Function (runtime)
 * - Cache: localStorage with TTL (1 hour)
 */

import { apiCall } from './api-service';

interface ShiftConfig {
    start: number;
    end: number;
    label: string;
}

interface AppointmentHours {
    earliest: number;
    latest: number;
    interval: number;
}

interface AppointmentType {
    value: string;
    name: string;
}

interface DynamicConfig {
    shifts: Record<string, ShiftConfig>;
    appointmentHours: AppointmentHours;
    maxDailyDeliveryAppointments: number;
    appointmentTypes: Record<string, string>;
    companyName?: string;
    companyLocation?: string;
}

interface Config extends DynamicConfig {
    SUPABASE_URL: string;
    BASE_URL: string;
    DEBUG: boolean;
    VERSION: string;
}

interface BackendShiftConfig {
    start: string;
    end: string;
    label?: string;
}

interface BackendConfigResponse {
    shifts?: Record<string, BackendShiftConfig>;
    appointmentHours?: AppointmentHours;
    maxDailyDeliveryAppointments?: number;
    appointmentTypeLabels?: Record<string, string>;
    companyName?: string;
    companyLocation?: string;
}

/**
 * Load and validate environment configuration
 */
function loadEnvironmentConfig(): { SUPABASE_URL: string; BASE_URL: string; DEBUG: boolean; VERSION: string; TURNSTILE_SITE_KEY: string } {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
    const DEBUG = import.meta.env.VITE_DEBUG === 'true';
    const VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

    const missingVars: string[] = [];

    if (!SUPABASE_URL || SUPABASE_URL === 'undefined' || SUPABASE_URL === '') {
        missingVars.push('VITE_SUPABASE_URL');
    }

    if (!BASE_URL || BASE_URL === 'undefined' || BASE_URL === '') {
        missingVars.push('VITE_BASE_URL');
    }

    if (!TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY === 'undefined' || TURNSTILE_SITE_KEY === '') {
        missingVars.push('VITE_TURNSTILE_SITE_KEY');
    }

    if (missingVars.length > 0) {
        const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}. Check your .env file.`;
        console.error(errorMsg);

        if (typeof document !== 'undefined') {
            const alertContainer = document.getElementById('alertContainer');
            if (alertContainer) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'background:#fee;border:1px solid #c00;padding:20px;margin:20px;border-radius:8px;color:#c00;text-align:center;';
                errorDiv.textContent = 'Yapilandirma Hatasi: Uygulama dogru yapilandirilmamis. Lutfen sistem yoneticisiyle iletisime gecin.';
                alertContainer.appendChild(errorDiv);
            }
        }

        throw new Error(errorMsg);
    }

    const errors: string[] = [];

    if (!SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.startsWith('http://localhost')) {
        errors.push('SUPABASE_URL must use HTTPS or be localhost');
    }

    if (!BASE_URL.startsWith('http://') && !BASE_URL.startsWith('https://')) {
        errors.push('BASE_URL must be a valid URL');
    }

    if (errors.length > 0) {
        const errorMsg = `Configuration validation errors: ${errors.join(', ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    return {
        SUPABASE_URL,
        BASE_URL,
        DEBUG,
        VERSION,
        TURNSTILE_SITE_KEY
    };
}

const ENV_CONFIG = loadEnvironmentConfig();

if (typeof window !== 'undefined') {
    (window as any).TURNSTILE_SITE_KEY = ENV_CONFIG.TURNSTILE_SITE_KEY;
}

const CACHE_KEY = 'randevu_config_cache';
const CACHE_TTL = 60 * 60 * 1000;

let memoryCache: { config: DynamicConfig; timestamp: number } | null = null;

function loadFromCache(): DynamicConfig | null {
    if (memoryCache) {
        const age = Date.now() - memoryCache.timestamp;
        if (age < CACHE_TTL) {
            return memoryCache.config;
        }
        memoryCache = null;
    }

    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { config, timestamp, version } = JSON.parse(cached);

        if (version !== ENV_CONFIG.VERSION) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        const age = Date.now() - timestamp;

        if (age < CACHE_TTL) {
            memoryCache = { config, timestamp };
            return config;
        }

        localStorage.removeItem(CACHE_KEY);
        return null;
    } catch (error) {
        console.warn('Config cache read error:', error);
        return null;
    }
}

function saveToCache(config: DynamicConfig): void {
    const timestamp = Date.now();
    memoryCache = { config, timestamp };

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            config,
            timestamp,
            version: ENV_CONFIG.VERSION
        }));
    } catch (error) {
        console.warn('Config cache write error:', error);
    }
}

function transformBackendConfig(backendConfig: BackendConfigResponse): DynamicConfig {
    const shifts: Record<string, ShiftConfig> = {};
    for (const [key, value] of Object.entries(backendConfig.shifts || {})) {
        const shift = value as BackendShiftConfig;
        shifts[key] = {
            start: parseInt(shift.start.split(':')[0]),
            end: parseInt(shift.end.split(':')[0]),
            label: shift.label || `${shift.start}-${shift.end}`
        };
    }

    const appointmentTypes: Record<string, string> = backendConfig.appointmentTypeLabels || {};

    return {
        shifts,
        appointmentHours: backendConfig.appointmentHours || { earliest: 11, latest: 21, interval: 60 },
        maxDailyDeliveryAppointments: backendConfig.maxDailyDeliveryAppointments || 3,
        appointmentTypes,
        companyName: backendConfig.companyName,
        companyLocation: backendConfig.companyLocation
    };
}

async function loadFromAPI(): Promise<DynamicConfig> {
    try {
        const response = await apiCall('getConfig');

        if (!response.success || !response.data) {
            throw new Error('Failed to load config from API');
        }

        const config = transformBackendConfig(response.data);
        saveToCache(config);

        return config;
    } catch (error) {
        console.error('Config API error:', error);
        throw error;
    }
}

export async function getConfig(forceRefresh: boolean = false): Promise<Config> {
    let dynamicConfig: DynamicConfig | null = null;

    if (!forceRefresh) {
        dynamicConfig = loadFromCache();
        if (dynamicConfig) {
            return { ...ENV_CONFIG, ...dynamicConfig };
        }
    }

    dynamicConfig = await loadFromAPI();

    return { ...ENV_CONFIG, ...dynamicConfig };
}

export async function initConfig(): Promise<Config> {
    try {
        const config = await getConfig();

        if (typeof window !== 'undefined') {
            (window as any).CONFIG = config;
        }

        if (ENV_CONFIG.DEBUG) {
            console.log('Config loaded:', {
                version: config.VERSION,
                backend: config.SUPABASE_URL.substring(0, 50) + '...',
                debug: config.DEBUG
            });
        }

        return config;
    } catch (error) {
        console.error('Config initialization error:', error);

        const fallbackConfig: Config = {
            ...ENV_CONFIG,
            shifts: {
                'morning': { start: 11, end: 18, label: 'Sabah (11:00-18:00)' },
                'evening': { start: 14, end: 21, label: 'Aksam (14:00-21:00)' },
                'full': { start: 11, end: 21, label: 'Full (11:00-21:00)' }
            },
            appointmentHours: { earliest: 11, latest: 21, interval: 60 },
            maxDailyDeliveryAppointments: 3,
            appointmentTypes: {
                'delivery': 'Saat Takdim',
                'service': 'Servis & Bakim',
                'consultation': 'Urun Danismanligi',
                'general': 'Genel Gorusme',
                'shipping': 'Gonderi'
            }
        };

        if (typeof window !== 'undefined') {
            (window as any).CONFIG = fallbackConfig;
        }

        return fallbackConfig;
    }
}

export async function checkAndInvalidateCache(): Promise<boolean> {
  try {
    const localVersion = localStorage.getItem('data_version');
    const response = await apiCall('getDataVersion');

    if (response.success && response.data !== localVersion) {
      clearConfigCache();
      localStorage.setItem('data_version', response.data);
      return true;
    }

    return false;
  } catch (error) {
    console.warn('[Cache] Version check failed:', error);
    return false;
  }
}

export function clearConfigCache(): void {
    memoryCache = null;
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (error) {
        console.warn('Cache clear error:', error);
    }
}

export function getEnvConfig() {
    return ENV_CONFIG;
}

export type { Config, DynamicConfig, ShiftConfig, AppointmentHours, AppointmentType };
