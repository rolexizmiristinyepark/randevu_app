/**
 * CONFIG LOADER - Single Source of Truth (Environment Variables Edition)
 *
 * SECURITY IMPROVEMENTS:
 * - Removed hardcoded URLs (now from environment variables)
 * - Added validation for required environment variables
 * - Runtime checks for production safety
 *
 * Architecture:
 * - Environment config (APPS_SCRIPT_URL, BASE_URL): From .env files (build-time)
 * - Business config (shifts, hours, limits): Loaded from API (runtime)
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
    APPS_SCRIPT_URL: string;
    BASE_URL: string;
    DEBUG: boolean;
    VERSION: string;
}

/**
 * Load and validate environment configuration
 * @throws {Error} If required environment variables are missing
 */
function loadEnvironmentConfig(): { APPS_SCRIPT_URL: string; BASE_URL: string; DEBUG: boolean; VERSION: string } {
    // Required environment variables
    const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
    const BASE_URL = import.meta.env.VITE_BASE_URL;

    // Validation
    const errors: string[] = [];

    if (!APPS_SCRIPT_URL) {
        errors.push('VITE_APPS_SCRIPT_URL is required');
    } else if (!APPS_SCRIPT_URL.startsWith('https://')) {
        errors.push('VITE_APPS_SCRIPT_URL must use HTTPS protocol');
    }

    if (!BASE_URL) {
        errors.push('VITE_BASE_URL is required');
    } else if (!BASE_URL.startsWith('http://') && !BASE_URL.startsWith('https://')) {
        errors.push('VITE_BASE_URL must be a valid URL');
    }

    if (errors.length > 0) {
        const errorMessage = [
            '❌ Environment Configuration Error:',
            '',
            ...errors.map(e => `  - ${e}`),
            '',
            '📝 Setup Instructions:',
            '  1. Copy .env.example to .env.production',
            '  2. Fill in your actual values',
            '  3. Rebuild the application',
            '',
            'See .env.example for details.'
        ].join('\n');

        throw new Error(errorMessage);
    }

    // Production safety check
    const DEBUG = import.meta.env.VITE_DEBUG === 'true';
    if (!DEBUG && APPS_SCRIPT_URL.includes('localhost')) {
        throw new Error('Cannot use localhost URL in production mode (VITE_DEBUG=false)');
    }

    return {
        APPS_SCRIPT_URL,
        BASE_URL,
        DEBUG,
        VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0'
    };
}

// Load environment config once at module load time
const ENV_CONFIG = loadEnvironmentConfig();

// Cache configuration
const CACHE_KEY = 'randevu_config_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Memory cache (faster than localStorage)
let memoryCache: { config: DynamicConfig; timestamp: number } | null = null;

/**
 * Load config from cache (localStorage or memory)
 * @returns {DynamicConfig | null} Cached config or null if expired/missing
 */
function loadFromCache(): DynamicConfig | null {
    // Check memory cache first (fastest)
    if (memoryCache) {
        const age = Date.now() - memoryCache.timestamp;
        if (age < CACHE_TTL) {
            return memoryCache.config;
        }
        // Expired, clear memory cache
        memoryCache = null;
    }

    // Check localStorage cache
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { config, timestamp, version } = JSON.parse(cached);

        // Version check - invalidate cache if version changed
        if (version !== ENV_CONFIG.VERSION) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        const age = Date.now() - timestamp;

        if (age < CACHE_TTL) {
            // Valid cache, update memory cache
            memoryCache = { config, timestamp };
            return config;
        }

        // Expired, clear cache
        localStorage.removeItem(CACHE_KEY);
        return null;
    } catch (error) {
        console.warn('Config cache read error:', error);
        return null;
    }
}

/**
 * Save config to cache (localStorage + memory)
 * @param {DynamicConfig} config - Config to cache
 */
function saveToCache(config: DynamicConfig): void {
    const timestamp = Date.now();

    // Save to memory cache
    memoryCache = { config, timestamp };

    // Save to localStorage cache
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

/**
 * Transform backend config response to frontend format
 * @param {any} backendConfig - Config from backend API
 * @returns {DynamicConfig} Transformed config
 */
function transformBackendConfig(backendConfig: any): DynamicConfig {
    // Transform shifts from backend format to frontend format
    const shifts: Record<string, ShiftConfig> = {};
    for (const [key, value] of Object.entries(backendConfig.shifts || {})) {
        const shift = value as any;
        shifts[key] = {
            start: parseInt(shift.start.split(':')[0]),
            end: parseInt(shift.end.split(':')[0]),
            label: shift.label || `${shift.start}-${shift.end}`
        };
    }

    // Transform appointment types from object to array format
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

/**
 * Load config from backend API
 * @returns {Promise<DynamicConfig>} Config from API
 */
async function loadFromAPI(): Promise<DynamicConfig> {
    try {
        const response = await apiCall('getConfig');

        if (!response.success || !response.data) {
            throw new Error('Failed to load config from API');
        }

        const config = transformBackendConfig(response.data);

        // Save to cache
        saveToCache(config);

        return config;
    } catch (error) {
        console.error('Config API error:', error);
        throw error;
    }
}

/**
 * Get complete config (environment + dynamic)
 *
 * Strategy:
 * 1. Try memory cache (fastest)
 * 2. Try localStorage cache
 * 3. Fetch from API (slowest)
 *
 * @param {boolean} forceRefresh - Force API fetch (skip cache)
 * @returns {Promise<Config>} Complete config
 */
export async function getConfig(forceRefresh: boolean = false): Promise<Config> {
    let dynamicConfig: DynamicConfig | null = null;

    // Try cache first (unless force refresh)
    if (!forceRefresh) {
        dynamicConfig = loadFromCache();
        if (dynamicConfig) {
            // Cache hit
            return { ...ENV_CONFIG, ...dynamicConfig };
        }
    }

    // Cache miss or force refresh - fetch from API
    dynamicConfig = await loadFromAPI();

    return { ...ENV_CONFIG, ...dynamicConfig };
}

/**
 * Initialize config and set to window.CONFIG
 * Called on page load
 */
export async function initConfig(): Promise<Config> {
    try {
        const config = await getConfig();

        // Expose to window for backward compatibility
        if (typeof window !== 'undefined') {
            (window as any).CONFIG = config;
        }

        // Log environment info in debug mode
        if (ENV_CONFIG.DEBUG) {
            console.log('🔧 Config loaded:', {
                version: config.VERSION,
                backend: config.APPS_SCRIPT_URL.substring(0, 50) + '...',
                debug: config.DEBUG
            });
        }

        return config;
    } catch (error) {
        console.error('Config initialization error:', error);

        // Fallback to environment config with defaults
        const fallbackConfig: Config = {
            ...ENV_CONFIG,
            shifts: {
                'morning': { start: 11, end: 18, label: 'Sabah (11:00-18:00)' },
                'evening': { start: 14, end: 21, label: 'Akşam (14:00-21:00)' },
                'full': { start: 11, end: 21, label: 'Full (11:00-21:00)' }
            },
            appointmentHours: { earliest: 11, latest: 21, interval: 60 },
            maxDailyDeliveryAppointments: 3,
            appointmentTypes: {
                'delivery': 'Saat Teslim Alma',
                'service': 'Servis & Bakım',
                'consultation': 'Ürün Danışmanlığı',
                'general': 'Genel Görüşme',
                'shipping': 'Gönderi'
            }
        };

        if (typeof window !== 'undefined') {
            (window as any).CONFIG = fallbackConfig;
        }

        return fallbackConfig;
    }
}

/**
 * Clear config cache (useful for debugging or forced refresh)
 */
export function clearConfigCache(): void {
    memoryCache = null;
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (error) {
        console.warn('Cache clear error:', error);
    }
}

// Export types
export type { Config, DynamicConfig, ShiftConfig, AppointmentHours, AppointmentType };
